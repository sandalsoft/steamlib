var Evernote = require('evernote').Evernote
var enml = require('enml-js')
var log = require('winston')

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

        // create a notebook object and populate it with data from Evernote
        var notebook = {}

// GOT AS FAR AS HERE
        var filter = self._createNotesFilter(defaultNotebook.guid, null, null)
        var resultSpec = self._createResultSpec()

        self._getNotesInNotebook(authToken, isUsingSanbox, filter, 0, null, resultSpec)
        .then(notes => {
          notebook.notes = notes
          resolve(notebook)
        })
        .catch(err => {
          reject(err)
        })
      })// noteStore.listNotebooks()
    }) // promise
  }, // getDefaultNotebook()

// TODO: change this function name to something that makes more sense
  _getNotesInNotebook: function (authToken, isUsingSanbox, filter, offset, maxNotesReturned, resultSpec) {
    var self = this
    var startingOffset = offset || 0
    var maxNotes = maxNotesReturned || MAX_NOTES_RETURNED
    var client = new Evernote.Client({token: authToken, sandbox: isUsingSanbox})
    var noteStore = client.getNoteStore()

    var notes = []

    return new Promise(function (resolve, reject) {
      noteStore.findNotesMetadata(filter, startingOffset, maxNotes, resultSpec, function (err, notesMeta) {
        if (err) { reject(err) }

        // log.debug(`Found ${notesMeta.notes.length}`)
        notesMeta.notes.map(evernote => {
          var note = {}
          note.title = evernote.title
          noteStore.getNote(authToken, evernote.guid, true, true, true, true, function (err, noteData) {
            if (err) reject(err)
            note = self._createNoteFromEvernote(noteData)

          	// Fetch tag names by mapping over tagGuids array
            noteData.tagGuids.map(tagGuid => {
              noteStore.getTag(authToken, tagGuid, function (err, evernoteTag) {
                if (err) { log.error(`ERROR getting tags for note ${note.title}`) }
                note.tags.append(evernoteTag)
              })// getTag
            })// tagGuid.map()
          })// getNote()
          // add new Note object to notes array
          notes.append(note)
        })// notes.map()
        resolve(notes)
      })// notStore.findNotes
    })// promise
  }, // _getNotesInNotebook()

  _createNoteFromEvernote (noteData) {
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
    note.tags = [] // noteData.tagNames// don't think we should bother with this field
    note.sharedWith = noteData.sharedNotes
    note.restrictions = noteData.restrictions
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
