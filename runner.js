#!/usr/bin/env node

var steamlib = require('./steamlib.js')
var authToken = process.env['EVERNOTE_DEV_TOKEN']

steamlib.getDefaultNotebook(authToken, true)
	.then(notebook => {
  console.log(`\n\t\t ${JSON.stringify(notebook)}`)
}).catch(err => console.log(`REJECTED ERROR: ${err}`))
