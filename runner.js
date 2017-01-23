#!/usr/bin/env node

var steamlib = require('./steamlib.js')
var authToken = process.env['EVERNOTE_DEV_TOKEN']

// steamlib.getDefaultNotebook(authToken, true)
// .then(notebook => {
//   console.log(`\n\t\tnotebook: ${notebook.name}`)
// })
// .catch(err => console.log(`REJECTED ERROR: ${err}`))

steamlib.getAllNotebooks(authToken, true)
.then(notebooks => {
  console.log(`\n\t\tnotebooks: ${notebooks}`)
})
.catch(err => console.log(`REJECTED ERROR: ${err}`))
