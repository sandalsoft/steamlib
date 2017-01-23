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
  notebooks.map(notebook => {
    console.log(`${notebook.name}`)
    notebook.notes.map(note => {
      console.log(`\t${note.title}`);
      note.tags.map(tag => {
        console.log(`\t\t${tag.name}`);
      })
    })
    
  })
  
})
.catch(err => console.log(`REJECTED ERROR: ${err}`))
