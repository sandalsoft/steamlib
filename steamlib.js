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
   * @param   {Boolean}  isUsingSandbox  'true' will use the development sandbox, 'false' will use the production environment.
   *
   * @return  {Promise[Array]}          Promise that resolves to an array containing all notebooks for the account
   */
  getAllNotebooks: function (authToken, isUsingSandbox) {
    var self = this
    var client = new Evernote.Client({token: authToken, sandbox: isUsingSandbox})
    var noteStore = client.getNoteStore()
    return new Promise(function (resolve, reject) {
      noteStore.listNotebooks(function (err, notebooks) {
        if (err) reject(err)

        var notebooksPromises = []
        notebooks.map(evernotebook => {
          notebooksPromises.push(self.getNotebook(authToken, isUsingSandbox, evernotebook.guid))
        })
        Promise.all(notebooksPromises).then(allNotebooks => {
          resolve(allNotebooks)
        })
        .catch(err => reject(err))
      })// noteStore.listNotebooks()
    }) // promise
  }, // getAllNotebook()

  getNotebook: function (authToken, isUsingSandbox, notebookGuid) {
    var self = this
    var client = new Evernote.Client({token: authToken, sandbox: isUsingSandbox})
    var noteStore = client.getNoteStore()
    return new Promise(function (resolve, reject) {
      noteStore.getNotebook(authToken, notebookGuid, function (err, evernotebook) {
        if (err) reject(err)

        var filter = self._createNotesFilter(notebookGuid, null, null)
        var resultSpec = self._createResultSpec()

        self._getNotesInNotebook(authToken, isUsingSandbox, filter, 0, null, resultSpec)
        .then(notes => {
          var notebook = self._createNotebookFromEvernotebook(evernotebook)
          notebook.notes = notes
          resolve(notebook)
        })
        .catch(err => reject(err))
      })// noteStore.getNotebook()
    })// Promise
  }, // getNotebook()

  /**
   * getDefaultNotebook Returns promise that resolves to the default Notebook
   *
   * @param   {String}   authToken          Developer authToken
   * @param   {Boolean}  isUsingSandbox  'true' will use the development sandbox, 'false' will use the production environment.
   *
   * @return  {Promise[Notebook]}       Promise that resolves to the default Notebook object https://dev.evernote.com/doc/reference/Types.html#Struct_Notebook.
   */
  getDefaultNotebook: function (authToken, isUsingSandbox) {
    var self = this
    var client = new Evernote.Client({token: authToken, sandbox: isUsingSandbox})
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

        self._getNotesInNotebook(authToken, isUsingSandbox, filter, 0, null, resultSpec)
        .then(notes => {
          notebook = self._createNotebookFromEvernotebook(defaultNotebook)
          notebook.notes = notes
          resolve(notebook)
        })
        .catch(err => reject(err))
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
   * @param   {Boolean}  isUsingSandbox  'true' will use the development sandbox, 'false' will use the production environment.
   * @param   {Evernote.NoteFilter}   filter  The fiter object containing details of the search.  This is how to get a Notebook and it's data
   * @param   {Int}   offset            When making multiple queries and using pagination, this is the index of results to start from
   * @param   {Int}   maxNotesReturned  Maximum number of results to return
   * @param   {Evernote.NotesMetadataResultSpec}   resultSpec   Configuration object that tells Evernote which resources to return from the server for a query.
   *
   * @return  {Promise[Note]}   Returns a Promise that resolves to an array of Notes (not Evernote.Notes)
   */

  _getNotesInNotebook: function (authToken, isUsingSandbox, filter, offset, maxNotesReturned, spec) {
    var self = this
    return new Promise(function (resolve, reject) {
      var startingOffset = offset || 0
      var maxNotes = maxNotesReturned || MAX_NOTES_RETURNED
      var client = new Evernote.Client({token: authToken, sandbox: isUsingSandbox})
      var noteStore = client.getNoteStore()
      var resultSpec = spec || self._createResultSpec()

      noteStore.findNotesMetadata(filter, startingOffset, maxNotes, resultSpec, function (err, notesMeta) {
        if (err) reject(err)
        if (typeof notesMeta === 'undefined' || notesMeta === null) reject(`notesMeta not defined or null`)

        self._getAllNotes(authToken, noteStore, notesMeta)
        .then(notesPromises => {
          Promise.all(notesPromises).then(allNotes => resolve(allNotes))
        })
        .catch(err => reject(err))
      })// findNotesMetadata
    })// promise
  }, // _getNotesInNotebook()

  _getAllNotes: function (authToken, noteStore, notesMeta) {
    var self = this
    return new Promise(function (resolve, reject) {
      var myNotesPromises = []
      notesMeta.notes.map(evernote => {
        myNotesPromises.push(self._getNote(authToken, evernote.guid, noteStore))
      })// map
      resolve(myNotesPromises)
    })// promise
  },

  _getNote: function (authToken, guid, noteStore) {
    var self = this
    return new Promise(function (resolve, reject) {
      noteStore.getNote(authToken, guid, true, true, true, true, function (err, noteData) {
        if (err) reject(err)
        if (noteData === 'undefined' || noteData === null) log.error(`Note data empty or null.. Continuing`) // reject(`Note data empty or null`)

        var note = self._createNoteFromEvernote(noteData)

        var tagList = []
        // If note has tags, fetch tag names by mapping over tagGuids array
        if (noteData.tagGuids) {
          noteData.tagGuids.map(tagGuid => {
            self._getTag(authToken, tagGuid, noteStore).then(tag => {
              log.debug(`note: ${note.title} -> tag: ${tag.name}`)
              tagList.push(tag)
            })// then
          })// map
        }// if tagGuids
        resolve(note)
      })// noteStore.getNote()
    })// Promise
  }, // _getNote()

  _getTag: function (authToken, tagGuid, noteStore) {
    return new Promise(function (resolve, reject) {
      noteStore.getTag(authToken, tagGuid, function (err, evernoteTag) {
        if (err) reject(err)
        resolve(evernoteTag)
      })// getTag
    })// promise
  }, // _getTag()

  _createNotebookFromEvernotebook: function (evernotebook) {
    var notebook = {}
    notebook.guid = evernotebook.guid
    notebook.name = evernotebook.name
    notebook.updateSequenceNum = evernotebook.updateSequenceNum
    notebook.isDefaultNotebook = evernotebook.defaultNotebook
    notebook.serviceCreatedAt = evernotebook.serviceCreated
    notebook.servieUpdatedAt = evernotebook.servieUpdated
    notebook.publishing = evernotebook.publishing
    notebook.isPublished = evernotebook.published
    notebook.stack = evernotebook.stack
    notebook.sharedNotebookIds = evernotebook.sharedNotebookIds
    notebook.sharedNotebooks = evernotebook.sharedNotebooks
    notebook.businessNotebook = evernotebook.businessNotebook
    notebook.contactUser = evernotebook.contact
    notebook.restrictions = evernotebook.restrictions
    notebook.recipientSettings = evernotebook.recipientSettings
    notebook.notes = []
    return notebook
  },

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
