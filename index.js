const { google } = require('googleapis')
const firestore = google.firestore('v1')

// regex to get Id of the doc being requested (which is the end of the path/name/url)
const regex = /([^/]+$)/g

const processItem = (item) => {
  // we need to inject the `id` and the `data()` method to make it compatible with existing API
  const id = item.name.match(regex)[0]
  const data = () => item.fields
  return {
    id,
    data
  }
}

// https://schier.co/blog/2013/11/14/method-chaining-in-javascript.html
class Firestore {
  constructor (value) {
    this.path = (value || '')
  }

  collection (path) {
    return new Firestore(`${this.path}/${path}`)
  }

  doc (path) {
    return new Firestore(`${this.path}/${path}`)
  }

  async get () {
    if (!process.env.GCLOUD_PROJECT) {
      throw new Error('Missing GCLOUD_PROJECT environment variable')
    }
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      throw new Error('Missing GOOGLE_APPLICATION_CREDENTIALS environment variable')
    }

    const auth = await google.auth.getClient({
      scopes: 'https://www.googleapis.com/auth/cloud-platform'
    })

    // https://cloud.google.com/firestore/docs/reference/rest/v1/projects.databases.documents/get
    const name = `projects/${process.env.GCLOUD_PROJECT}/databases/(default)/documents${this.path}`

    // reset path state
    this.path = ''

    let result
    try {
      result = await firestore.projects.databases.documents.get({
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
    if (!result.data.documents) {
      // since there is no documents field, we know that this is just a `.doc` call and there
      // is only one item that will be returned
      return processItem(result.data)
    }

    // if there is `result.data.documents`, then we are returning a collection, which means we
    // need to map over each item being returned and add the same values
    return result.data.documents.map(doc => processItem(doc))
  }
}

module.exports = Firestore
