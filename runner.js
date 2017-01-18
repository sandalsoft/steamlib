#!/usr/bin/env node

var steamlib = require('./steamlib.js')
var authToken = process.env['EVERNOTE_DEV_TOKEN']

steamlib.getDefaultNotebook(authToken, true)
	.then(notebook => {
  console.log(JSON.stringify(notebook))
})
