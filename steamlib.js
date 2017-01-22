var Evernote = require('evernote').Evernote
var enml = require('enml-js')
var log = require('winston')
log.level = process.env['NODE_LOG_LEVEL'] || 'debug'

const MAX_NOTES_RETURNED = 250

module.exports = {

  /**
   * Returns Promise that resolves to an array of all Notebook in the account
   *
   * @param   {String}   authToken          Developer authToken
   * @param   {Boolean}  isUsingSanbox  'true' will use the development sandbox, 'false' will use the production environment.
   *
   * @return  {Promise[Array]}          Promise that resolves to an array containing all notebooks for the account
   */
  getAllNotebooks: function (authToken, isUsingSanbox) {
    var client = new Evernote.Client({token: authToken, sandbox: isUsingSanbox})
    var noteStore = client.getNoteStore()
    return new Promise(function (resolve, reject) {
      noteStore.listNotebooks(function (err, notebooks) {
        if (err) { reject(err) }
        resolve(notebooks)
      })// noteStore.listNotebooks()
    }) // promise
  }, // getAllNotebook()

  /**
   * getDefaultNotebook Returns promise that resolves to the default Notebook
   *
   * @param   {String}   authToken          Developer authToken
   * @param   {Boolean}  isUsingSanbox  'true' will use the development sandbox, 'false' will use the production environment.
   *
   * @return  {Promise[Notebook]}       Promise that resolves to the default Notebook object https://dev.evernote.com/doc/reference/Types.html#Struct_Notebook.
   */
  getDefaultNotebook: function (authToken, isUsingSanbox) {
    var self = this
    var client = new Evernote.Client({token: authToken, sandbox: isUsingSanbox})
    var noteStore = client.getNoteStore()
    return new Promise(function (resolve, reject) {
      noteStore.getDefaultNotebook(function (err, defaultNotebook) {
        if (err) reject(err)
        if (defaultNotebook === 'undefined' || defaultNotebook === null) reject(`Cannot get default Notebook`)
        // create a notebook object and populate it with data from Evernote
        var notebook = {}
        // log.debug(`DefaultNotebook: ${JSON.stringify(defaultNotebook)}`)
        var filter = self._createNotesFilter(defaultNotebook.guid, null, null)
        var resultSpec = self._createResultSpec()

        self._getNotesInNotebook(authToken, isUsingSanbox, filter, 0, null, resultSpec)
        .then(notes => {
          log.info(`there are ${notes.count} notes I've found!`)
          notebook.notes = notes
          resolve(notebook)
        })
        .catch(err => {
          log.debug(`err caught in _getNotesInNotesbook:  ${err}`)
          reject(err)
        })
      })// noteStore.listNotebooks()
    }) // promise
  }, // getDefaultNotebook()

// TODO: change this function name to something that makes more sense
  /**
   *  Fetches all notes in the Notenbook specified by the GUID of the notebookGuid property of the filter.
   *  The Evernote SDK flow is lame, this corrects that.  Given a Notebook GUID, create a filter that
   *  doesn't filter anything, it gets the metdata for all notes associated with that notebook.  Then we iterate
   *  through all the Note.guids and fetch the Evernote.Note data. We then iterate over the tagGuids and grab Tag data for
   *  each tagGuid the Note has.   We create a new Note object and return it in a promise
   *
   *
   * @param   {String}   authToken         Developer authToken
   * @param   {Boolean}  isUsingSanbox  'true' will use the development sandbox, 'false' will use the production environment.
   * @param   {Evernote.NoteFilter}   filter  The fiter object containing details of the search.  This is how to get a Notebook and it's data
   * @param   {Int}   offset            When making multiple queries and using pagination, this is the index of results to start from
   * @param   {Int}   maxNotesReturned  Maximum number of results to return
   * @param   {Evernote.NotesMetadataResultSpec}   resultSpec   Configuration object that tells Evernote which resources to return from the server for a query.
   *
   * @return  {Promise[Note]}   Returns a Promise that resolves to an array of Notes (not Evernote.Notes)
   */

  _getNotesInNotebook: function (authToken, isUsingSanbox, filter, offset, maxNotesReturned, resultSpec) {
    log.debug(`in _getNotesInNotebook `)
    var self = this
    return new Promise(function (resolve, reject) {
      var startingOffset = offset || 0
      var maxNotes = maxNotesReturned || MAX_NOTES_RETURNED
      var client = new Evernote.Client({token: authToken, sandbox: isUsingSanbox})
      var noteStore = client.getNoteStore()
      var myNotes = []

      noteStore.findNotesMetadata(filter, startingOffset, maxNotes, resultSpec, function (err, notesMeta) {
        log.debug(typeof myNotes)
        if (err) {
          log.error(`err is defined as: ${err}`)
        //   reject(err)
        }
        if (err) {
          log.error('err !== null')
        }
        if (typeof notesMeta === 'undefined' || notesMeta === null) {
          log.error(`notesMeta not defined or null`)
          reject(`notesMeta not defined or null`)
        }
        var noteList = []
        noteList = notesMeta.notes
        for (var evernote of noteList) {
          var note = {}
          note.title = evernote.title
          self._getNote(authToken, evernote.guid, noteStore)
          .then(myNotes.push)
          // noteStore.getNote(authToken, evernote.guid, true, true, true, true, function (err, noteData) {
            // Do I want to reject if a note isn't found?  Probably not, just send error message
        }// for
      })// findNotesMetadata
    })// promise
  }, // _getNotesInNotebook()

  _getNote: function (authToken, guid, noteStore) {
    var self = this
    return new Promise(function (resolve, reject) {
      noteStore.getNote(authToken, guid, true, true, true, true, function (err, noteData) {
        if (err) reject(err)
        if (noteData === 'undefined' || noteData === null) log.error(`Note data empty or null.. Continuing`)
        log.debug(`noteData: ${JSON.stringify(noteData)}`)
        var note = self._createNoteFromEvernote(noteData)
        log.debug(`\tnote title: ${note.title}`)

        // If note has tags, fetch tag names by mapping over tagGuids array
        if (noteData.tagGuids) {
          noteData.tagGuids.map(tagGuid => {
            self._getTag(authToken, tagGuid, noteStore).then(tag => {
              note.tags.push(tag)
            })// then
          })// map
        }
        resolve(note)
      })// noteStore.getNote()
    })// Promise
  }, // _getNote()

  _getTag: function (authToken, tagGuid, theNoteStore) {
    var self = this
    return new Promise(function (resolve, reject) {
      theNoteStore.getTag(authToken, tagGuid, function (err, evernoteTag) {
        if (err) reject(err)
        resolve(evernoteTag)
      })// getTag
    })// promise
  }, // _getTag()

  _createNoteFromEvernote: function (noteData) {
    var note = {}
    note.content = {}
    note.content.plaintText = enml.PlainTextOfENML(noteData.content)
    note.content.html = enml.HTMLOfENML(noteData.content, noteData.resources)
    note.content.enml = noteData.content
    note.title = noteData.title
    note.contentHash = noteData.contentHash
    note.createdAt = noteData.created
    note.updatedAt = noteData.updated
    note.deletedAt = noteData.deleted
    note.isActive = noteData.active
    note.updatedSequenceNum = noteData.updateSequenceNum
    note.notebookGuid = noteData.notebookGuid
    note.tagGiuds = noteData.tagGuids
    note.resources = noteData.resources
    note.attirbutes = noteData.attirbutes
    note.sharedWith = noteData.sharedNotes
    note.restrictions = noteData.restrictions

    // noteData.tagNames// don't think I will bother with this field
    note.tags = []
    return note
  },

  _createNotesFilter: function (notebookGuid, queryString, tagGuidList) {
    if (!notebookGuid) {
      log.error(`_createNotesFilter() requires a notebookGuid`)
      process.exit(1)
    }

    var filter = new Evernote.NoteFilter()
    filter.notebookGuid = notebookGuid
    filter.words = queryString
    filter.tagGuids = tagGuidList

    filter.order = 0
    filter.ascending = true
    filter.timeZone = 'America/Chicago'
    filter.inactive = false
    filter.emphasized = null
    filter.includeAllReadableNotebooks = null
    return filter
  },

  _createResultSpec: function () {
    // create a new result spec for findNotesMetadata
    var resultSpec = new Evernote.NotesMetadataResultSpec()
    // set the result spec to include all fields
    resultSpec.includeTitle = true
    resultSpec.includeContent = true
    resultSpec.includeResourcesData = true
    resultSpec.includeNoteAppDataValues = true
    resultSpec.includeResourcesRecognition = true
    resultSpec.includeResourcesAlternateData = true
    resultSpec.includeSharedNotes = true
    resultSpec.includeResourceAppDataValues = true
    resultSpec.includeAccountLimits = true

    return resultSpec
  }
}// exports
