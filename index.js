const { google } = require('googleapis')
const { convert } = require('firestore-adapter')
const moment = require('moment')
const uniqid = require('uniqid');
const firestore = google.firestore('v1')

// regex to get Id of the doc being requested (which is the end of the path/name/url)
const regex = /([^/]+$)/g

/**
 * Processes the item for compatibility with the existing Firestore API
 *
 * @param {Object} item - the item to be processed, which is a single document
 */
const processItem = (item) => {
  // we need to inject the `id` and the `data()` method to make it compatible with existing API
  const id = item.name.match(regex)[0]
  // normalize data from typed values into usable values
  // https://cloud.google.com/firestore/docs/reference/rest/v1/Value

  return {
    id,
    data: () => convert.docToData(item.fields)
  }
}

const checkEnv = () => {
  if (!process.env.GCLOUD_PROJECT) {
    throw new Error('Missing GCLOUD_PROJECT environment variable')
  }
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error('Missing GOOGLE_APPLICATION_CREDENTIALS environment variable')
  }
}


/**
 * A class that models the result of get
 */
class QueryResult {
  constructor(response, queries) {
    /** save whole data from response */
    this.docs = response.data.documents.map(doc => processItem(doc))

    /** filter the result (for where() function) */
    if (queries) {
      /** comparison operators */
      const operators = {
        '>': (a, b) => a > b,
        '<': (a, b) => a < b,
        '>=': (a, b) => a >= b,
        '<=': (a, b) => a <= b,
        '==': (a, b) => a == b,
        'array-contains': (a, b) => a.indexOf(b) > -1
      }
      /** filter the result based on the queries */
      this.docs = this.docs.filter(doc => {
        const data = doc.data()
        /** check if this doc matches the query */
        const isValid = queries.every(query => {
          const { fieldPath, opStr, value } = query
          return operators[opStr](data[fieldPath], value)
        })
        return isValid
      })
    }

    this.exists = !!this.docs.length
  }

  forEach(cb) {
    this.docs.forEach(doc => cb(doc))
  }
}


// https://schier.co/blog/2013/11/14/method-chaining-in-javascript.html
class Firestore {
  constructor (value, query = null) {
    this.path = (value || '')
    if (query) {
      this.queries ? this.queries.push(query) : this.queries = [query]
    }
  }

  collection (path) {
    const ref = new Firestore(`${this.path}/${path}`)
    ref.set = ref.delete = undefined
    return ref
  }

  doc (path) {
    const ref = new Firestore(`${this.path}/${path}`)
    ref.add = ref.where = undefined
    return ref
  }

  where(fieldPath, opStr, value) {
    /** new Firestore instance with path and query */
    const ref = new Firestore(`${this.path}`, { fieldPath, opStr, value })
    ref.add = ref.set = ref.doc = ref.collection = ref.delete = undefined
    return ref
  }

  async get () {
    checkEnv()

    const auth = await google.auth.getClient({
      scopes: 'https://www.googleapis.com/auth/cloud-platform'
    })

    // https://cloud.google.com/firestore/docs/reference/rest/v1/projects.databases.documents/get
    const name = `projects/${process.env.GCLOUD_PROJECT}/databases/(default)/documents${this.path}`

    let response
    try {
      response = await firestore.projects.databases.documents.get({
        name,
        auth
      })
    } catch (err) {
      console.error(err)
    }

    /**
     * There are a few things we still need to manage to make the API compatible with the existing
     * Firestore api. The Firestore API returns a snapshot, which requires a `.data()` call to get
     * the data, and it gives the `id` of the item.
     */

    // first check if this is the result for a collection or a document. if it's for a collection,
    // there will be a `data.documents` field. if not, there will just be `data`.
    if (!response.data.documents) {
      // since there is no documents field, we know that this is just a `.doc` call and there
      // is only one item that will be returned
      return processItem(response.data)
    }

    // if there is `result.data.documents`, then we are returning a collection, which means we
    // need to map over each item being returned and add the same values
    return new QueryResult(response, this.queries)
  }

  async set(data, options = {}) {
    checkEnv()

    const auth = await google.auth.getClient({
      scopes: 'https://www.googleapis.com/auth/cloud-platform'
    })

    // https://cloud.google.com/firestore/docs/reference/rest/v1/projects.databases.documents/get
    const name = `projects/${process.env.GCLOUD_PROJECT}/databases/(default)/documents${this.path}`

    /** convert the data which is a json to Firestore document - https://cloud.google.com/firestore/docs/reference/rest/v1/projects.databases.documents#Document */
    const resource = {
      name,
      ...convert.dataToDoc(data),
    }

    const opts = {}

    /** If merge set to `true`, the existing fields on server should be remained.
     *  If the document exists on the server and has fields not referenced in the mask, they are left unchanged.
     *  Patch function handles merge with `updateMask.fieldPaths` option. If it's not provided, it just set with the new data
     */
    if (options.merge)
      opts['updateMask.fieldPaths'] = Object.keys(data) // Set the fields of data

    /** Update only specific fields */
    if (options.mergeFields)
      opts['updateMask.fieldPaths'] = options.mergeFields

    let response
    try {
      response = await firestore.projects.databases.documents.patch({
        name,
        auth,
        resource,
        ...opts
      })
    } catch (err) {
      console.error(err)
    }

    const result = {
      /** Javascript moment object */
      writeTime: moment(response.data.updateTime),
      /** isEqual function */
      isEqual: (value) => {
        const data = convert.docToData(response.data.fields)
        return JSON.stringify(data) === JSON.stringify(value)
      }
    }

    return result
  }

  async add(data) {
    const id = uniqid()
    return this.doc(id).set(data)
  }

  async delete() {
    checkEnv()

    const auth = await google.auth.getClient({
      scopes: 'https://www.googleapis.com/auth/cloud-platform'
    })

    // https://cloud.google.com/firestore/docs/reference/rest/v1/projects.databases.documents/get
    const name = `projects/${process.env.GCLOUD_PROJECT}/databases/(default)/documents${this.path}`

    let response
    try {
      response = await firestore.projects.databases.documents.delete({
        name,
        auth
      })
    } catch (err) {
      console.error(err)
    }

    return response.data
  }
}

module.exports = Firestore
