# Firestore REST

[![npm version](https://img.shields.io/npm/dt/firestore-rest.svg?style=flat-square)](https://img.shields.io/npm/dt/firestore-rest.svg)
[![npm version](https://img.shields.io/npm/v/firestore-rest.svg?style=flat-square)](https://www.npmjs.com/package/firestore-rest)

Due to an issue with gRPC, any request that involves Firestore in conjunction with Firebase Functions with take 5-10 seconds to respond after a deploy.

For more information about this particular issue, see [this ticket](https://github.com/googleapis/nodejs-firestore/issues/528).

As of February 2019, if you want your Firestore requests to respond in less than 5-10 seconds after a deploy, you have to use the REST API provided by `googleapis`.

This package wraps the [`googleapis`](https://github.com/googleapis/google-api-nodejs-client/) class for [Firestore](https://apis-nodejs.firebaseapp.com/firestore/classes/Firestore.html) in a way that is easier to use.

Hopefully, when [this ticket](https://github.com/googleapis/gax-nodejs/issues/401) is resolved, this package will no longer be necessary, but according to Google support, this might be a persistent issue until late 2019. Until then, you should be able to use this package without much downside.

https://cloud.google.com/firestore/docs/reference/rest/v1/projects.databases.documents

## Set up

```
npm i --save firestore-rest
```

You will need to ensure that you have `GOOGLE_APPLICATION_CREDENTIALS` and `GCLOUD_PROJECT` as environment variables. The former is the path to your `.json` credentials file, and the latter is the project name.

**NOTE:** I found that I had to export these within the function because Firebase Functions does not allow upper-case variable names for some reason. If you try to do so, you'll get the following error:

```s
Error: Invalid config name onCadenceAssignToContact.GOOGLE_APPLICATION_CREDENTIALS, cannot use upper case.
```

So my firebase initialization file has this at the top:

```js
process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(__dirname, '../path/to/credentials.json')
process.env.GCLOUD_PROJECT = 'my-app-name'
```

These aren't secret, so it doesn't really matter how you pass those values to the API.

## Usage

When initializing `firebase-admin`, initialize and export `db` as well. See example below for one way to configure your app:

```js
const admin = require('firebase-admin')
const Firestore = require('firestore-rest')
const path = require('path')

process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(__dirname, '../path/to/credentials.json')
process.env.GCLOUD_PROJECT = 'my-app-name'

var serviceAccount = require('../path/to/credentials.json')

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://<your app>.firebaseio.com'
})

// const db = admin.firestore() <= this is the old way to do it
const db = new Firestore()

module.exports = {
  admin,
  db
}
```

Then you can use the function the same way you would otherwise, as this package transforms the results to be backwards-compatible. For example:

```js
const getSome = async () => {
  try {
    const response = await db.collection('users').doc('12312312421321').get()
    console.log(response)
  } catch (err) {
    console.error(err)
  }
}
```
<<<<<<< HEAD

## TODO

This currently only supports `.collection` and `.doc` calls with a `.get` method. At some point, this will need to include other methods such as `.where` to be more robust.
=======
>>>>>>> ea6d7665de6872fdaf92fa732066601304094e0e
