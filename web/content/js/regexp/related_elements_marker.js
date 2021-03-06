define('ess/regex/related_elements_marker', ['ace/token_iterator', 'ace/range'], function(require, exports, module) {
  "use strict";

  var TokenIterator = require('ace/token_iterator').TokenIterator
  var Range = ace.require('ace/range').Range;

  function orSymbolRelatedElementFinder(itr, t, consumer) {
    var range = 0
    var savedItrState = saveTokenIteratorState(itr)

    var lastOr = t;
    lastOr.row = itr.getCurrentTokenRow()

    do {
      var currentToken = itr.stepBackward()
      if (!currentToken) break

      if (currentToken.type == 'openBracket') {
        if (range == 0) {
          break
        }
        else {
          range--
        }
      }
      else if (currentToken.type == 'closedBracket') {
        range++
      }
      else if (range == 0 && currentToken.type == 'orSymbol') {
        var column = itr.getCurrentTokenColumn()
        var currentTokenRow = itr.getCurrentTokenRow();
        currentToken.start = column
        currentToken.row = currentTokenRow

        consumer(new Range(currentTokenRow, column + currentToken.value.length, lastOr.row, lastOr.start))

        lastOr = currentToken
      }
    } while (true)

    itr.stepForward()

    consumer(new Range(itr.getCurrentTokenRow(), itr.getCurrentTokenColumn(), lastOr.row, lastOr.start))

    // Go forward
    loadTokenIteratorState(itr, savedItrState)

    lastOr = t;
    range = 0
    do {
      currentToken = itr.stepForward()
      if (!currentToken) break

      if (currentToken.type == 'openBracket') {
        range++
      }
      else if (currentToken.type == 'closedBracket') {
        if (range == 0) {
          break
        }
        else {
          range--
        }
      }
      else if (range == 0 && currentToken.type == 'orSymbol') {
        column = itr.getCurrentTokenColumn()
        currentTokenRow = itr.getCurrentTokenRow();
        currentToken.start = column
        currentToken.row = currentTokenRow

        consumer(new Range(lastOr.row, lastOr.start + lastOr.value.length, currentTokenRow, column))

        lastOr = currentToken
      }
    } while (true)

    itr.stepBackward()

    consumer(new Range(lastOr.row, lastOr.start + lastOr.value.length, 
                       itr.getCurrentTokenRow(), itr.getCurrentTokenColumn() + itr.getCurrentToken().value.length))
  } 
  
  function quantifierRelatedElementFinder(itr, t, consumer) {
    t.row = itr.getCurrentTokenRow()

    var range = 0

    do {
      var currentToken = itr.stepBackward()
      if (!currentToken) {
        itr.stepForward()
        break
      }

      if (currentToken.type == 'escapedSymbol') {
        currentToken = itr.stepBackward()
        if (!currentToken) {
          itr.stepForward()
          break
        }
      }
      
      if (currentToken.type == 'openBracket') {
        if (range == 0) {
          itr.stepForward()
          break
        }
        else {
          range--
        }
      }
      else if (currentToken.type == 'closedBracket') {
        range++
      }
    } while (range > 0)

    consumer(new Range(itr.getCurrentTokenRow(), itr.getCurrentTokenColumn(), t.row, t.start))
  }
  
  function groupReferenceRelatedElementFinder(itr, t, consumer, session) {
    var bracketStructure = session.bracketStructure
    if (!bracketStructure) return
    
    var groupNumber = parseInt(t.value.substring(1))
    var br = bracketStructure.groups[groupNumber - 1]
    if (!br) return
    
    var closedBr = br.pair
    
    if (closedBr.row > itr.getCurrentTokenRow() || (closedBr.row == itr.getCurrentTokenRow() && closedBr.column > t.start)) {
      return
    }
    
    consumer(new Range(br.row, br.column, closedBr.row, closedBr.end))
  }
  
  var supportedRelatedElements = {
    orSymbol: orSymbolRelatedElementFinder,
    quantifier: quantifierRelatedElementFinder,
    groupRef: groupReferenceRelatedElementFinder
  }
  
  var RelatedElementMarker = function(regexpEditor) {
    this.update = function (html, markerLayer, session, config) {
      if (!regexpEditor.isFocused()) return

      var cursorPos = session.getSelection().getCursor()

      var t = session.getTokenAt(cursorPos.row, cursorPos.column + 1)

      if (!t || (!supportedRelatedElements.hasOwnProperty(t.type))) {
        if (cursorPos.column == 0) {
          return
        }

        t = session.getTokenAt(cursorPos.row, cursorPos.column)

        if (!t || (!supportedRelatedElements.hasOwnProperty(t.type))) {
          return
        }
      }

      var itr = new TokenIterator(session, cursorPos.row, t.start + 1)

      supportedRelatedElements[t.type](itr, t, function(range) {
        if (!range.isEmpty()) {
          drawLineMarker(markerLayer, html, range, session, 'relatedToken', config)
        }
      }, session)
    }
  };

  //(function() {
  //
  //}).call(RelatedElementMarker.prototype);

  exports.RelatedElementMarker = RelatedElementMarker;
});
