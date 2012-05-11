'use strict';

var MailAPI = null;

const PAGE_TRANSITION_DURATION = 300,
  CACHE_DOM_PAGES = 2,
  DEFAULT_DIRECTION = 1,
  MESSAGES_PER_SCREEN = 5,

  //simple regexp for parse addresses
  R_ADDRESS_PARTS = /^(?:([\w\s]+) )?<(.+)>$/,

  R_HTML_TEMPLATE = /\{\{(\w+?)\}\}/g,

  STORE_ACCOUNTS_KEYS = 'mail:accounts',

  DEFAULT_FOLDER = 'INBOX';

var mail = {
  firstScreen: function() {

    const DOMAINS = {},
      R_EMAIL_DOMAIN = /@(.*)$/;

    //var pages = new Paging(nodes.firstScreen);

    //pages.registerPage(nodes.selectAccount);

    nodes.firstScreen.hidden = false;

    nodes.selectExistButton.addEventListener('click', function() {
      nodes.firstScreen.hidden = true;
      mail.folderScreen();
    });

    nodes.loginForm.addEventListener('submit', function(e) {

      var emailAddress = this.account.value,
        password = this.password.value;

      e.preventDefault();

      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }

      nodes.firstScreen.hidden = true;

      // XXX just hardcode use of localhost for now, and no SSL because
      // localhost does not have a valid certificate.
      MailAPI.tryToCreateAccount(
          {
            emailAddress: emailAddress,
            password: password
          },
          function(err) {
            if (err) {
              // XXX display feedback if there was an error.
              return;
            }
            // (account was successfully created)
            mail.folderScreen();
          }
        );
    });


    [].forEach.call(nodes.preSelectMail.querySelectorAll('img'), function(img) {
      DOMAINS[img.dataset.domain] = {
        title: img.alt,
        img: img.cloneNode(true)
      };
    });

    Object.freeze(DOMAINS);

    nodes.loginForm.account.addEventListener('updatevalue', function() {
        //will need to add autocomplete

        var parts = this.value.match(R_EMAIL_DOMAIN);

        nodes.preMailSelected.innerHTML = '';

        //let tmp;
        if (parts && parts[1] && DOMAINS[parts[1]]) {
          let tmp = DOMAINS[parts[1]];

          nodes.preMailSelected.appendChild(tmp.img);
          nodes.preMailSelected
            .appendChild(document.createElement('span'))
            .textContent = ' ' + tmp.title;

        }

    });

    nodes.preSelectMail.addEventListener('click', function(e) {
      var nodeName = e.target.nodeName.toLowerCase(),
        img;

      if (nodeName === 'img') {
        img = e.target;
      } else if (nodeName === 'a') {
        img = e.target.querySelector('img');
      } else {
        return;
      }


      var account = nodes.loginForm.account,
        value = account.value,
        i = value.indexOf('@'),
        domain = img.dataset.domain,
        range = document.createRange();

      if (i !== -1) {
        //console.log(value.slice(i));
        value = value.slice(0, i) + '@' + domain;
      } else {
        i = value.length;
        value = value + '@' + domain;
      }

      account.value = value;
      account.focus();
      account.setSelectionRange(i, i);

      e.preventDefault();
    });

    nodes.preSelectMail.addEventListener('mousedown', function(e) {
      e.preventDefault();
    }, true);

  },
  folderScreen: function() {
    var foldersSlice = MailAPI.viewFolders();
    foldersSlice.onsplice = function m_onsplice(index, howMany, addedItems,
                                                requested, moreExpected) {
      var folder;
      if (howMany) {
        for (var i = index + howMany - 1; i >= index; i--) {
          folder = msgSlice.items[i];
          folder.element.parentNode.removeChild(folder.element);
        }
      }

      var insertBuddy = (index >= nodes.folders.childElementCount) ?
                          null : nodes.folders.children[index];
      addedItems.forEach(function(folder) {
          folder.element = mail.makeFolderDOM(folder);
          nodes.folders.insertBefore(folder.element, insertBuddy);
          if (folder.selectable) {
            // (we don't actually need a closure)
            folder.element.addEventListener('click', function() {
                nodes.folderScreen.hidden = true;
                mail.mailScreen(folder);
              }, false);
          }
        });
    };

    nodes.folderScreen.hidden = false;
  },
  killMailScreen: function() {
    if (nodes.mailScreen.slice) {
      nodes.mailScreen.slice.die();
      nodes.mailScreen.slice = null;
    }
    nodes.mailScreen.hidden = true;
  },
  mailScreen: function(folder) {
    var msgSlice = nodes.mailScreen.slice = MailAPI.viewFolderMessages(folder);

    msgSlice.onsplice = function(index, howMany, addedItems, requested,
                                 moreExpected) {
        // - removed messages
        // (This should really only happen on the settings page.)
        if (howMany) {
          for (var i = index + howMany - 1; i >= index; i--) {
            var message = msgSlice.items[i];
            message.element.parentNode.removeChild(message.element);
          }
        }

        // - added/existing accounts
        var insertBuddy = (index >= nodes.messagesList.childElementCount) ?
                            null : nodes.messagesList.children[index];
        addedItems.forEach(function(message) {
          var domMessage = message.element = mail.makeMessageDOM(message);
          nodes.messagesList.insertBefore(domMessage, insertBuddy);
        });
      };

    var swipedTarget,
      taped = false,
      left = 0,
      width = 0,
      started = false,

      getMessage = function(target){

        while (!('messageId' in target.dataset)) {

          if ((target = target.parentNode) === nodes.mailScreen) {
            return null;
          };

        }

        return target;

      },
      cleanTap = function() {
        document.removeEventListener('tapstart', tapStart);
        document.removeEventListener('tapend', tapEnd);
        taped = false;
      },
      tapEnd = function() {

        mail.readMessage(swipedTarget);

        if (taped) {
          swipedTarget.classList.remove('highlight');
        }
        cleanTap();
        cleanSwipe();

      },
      tapStart = function() {
        swipedTarget.classList.add('highlight');
        taped = true;

        document.addEventListener('tapend', tapEnd);
      },
      cleanSwipe = function() {
        document.removeEventListener('swipestart', swipeStart);
        document.removeEventListener('mousemove', mouseMove);
        document.removeEventListener('swipeend', swipeEnd);
        swipedTarget = null;
      },
      swipeEnd = function() {
        swipedTarget.classList.remove('highlight');
        cleanSwipe();
      },
      swipeStart = function(e) {

        if (taped) {
          cleanTap();
        }

        if (e.detail & SWIPE_HORIZONTAL) {
          console.log('swipe');
          document.addEventListener('mousemove', mouseMove);
        }


      },
      mouseMove = function(e) {
        if (!started && left - e.layerX > width / 3) {
          started = true;
        }

        if (started) {

        }
      };

    nodes.mailScreen.hidden = false;

    nodes.folderTitle.textContent = folder.name;

    nodes.mailScreen.mainContent.addEventListener('mousedown', function downListener(e) {
      swipedTarget = getMessage(e.target);

      if(!swipedTarget) {
        return;
      }

      left = e.layerX,
      width = swipedTarget.offsetWidth,
      started = false;

      document.addEventListener('tapstart', tapStart);


      if (left > width - width / 10) {
        document.addEventListener('swipestart', swipeStart);
      }

      document.addEventListener('swipeend', swipeEnd);

    }, true);

    mail.screens = new Paging(nodes.mailScreen);
    nodes.messageFrame.header =
      nodes.messageFrame.querySelector('.message-frame-header');
    nodes.messageFrame.body =
      nodes.messageFrame.querySelector('.message-frame-body');
  },
  defaultDirection: DEFAULT_DIRECTION,
  makeFolderDOM: function(folder) {
    var folderNode = document.createElement('article');
    folderNode.setAttribute('role', 'row');
    folderNode.classList.add('folder-item');
    folderNode.classList.add('folderType-' + folder.type);
    var folderName = folderNode.appendChild(document.createElement('h1'));
    folderName.classList.add('folder-name');
    folderName.textContent = folder.name;
    return folderNode;
  },
  makeMessageDOM: function(data) {
    var message = document.createElement('article');

    message.header = data;
    message.setAttribute('role', 'row');
    message.classList.add('message-summary');
    let header = message.appendChild(document.createElement('header'));
    header.classList.add('message-summary-header');
    let address = header.appendChild(document.createElement('address'));
    address.classList.add('message-summary-mail');
    address.appendChild(document.createElement('span')).textContent = [
      data.date.getDate(),
      data.date.getMonth() + 1,
      data.date.getYear() - 100
    ].join('.').replace(/(^|\.)(\d)(?!\d)($|\.)/g, '$10$2$3');
    let author = header.appendChild(document.createElement('h1'));
    author.classList.add('message-summary-author');
    author.textContent = data.author.name || data.author.address;
    let subject = header.appendChild(document.createElement('h2'));
    subject.classList.add('message-summary-subject');
    subject.textContent = data.subject;
    let summary = message.appendChild(document.createElement('div'));
    summary.classList.add('message-summary-text');
    summary.textContent = data.snippet;

    // also available:
    //data.isRead
    //data.isStarred
    //data.isRepliedTo
    //data.hasAttachments

    message.dataset.messageId = data.id;

    return message;
  },
  populateMessageBodyDom: function(mailBody) {
    var header = nodes.messageFrame.header;
    header.innerHTML = '';
    function addHeaderEmails(key, pairs) {
      var line = document.createElement('h2'),
          label = document.createElement('span'),
          people = document.createelement('span');
      label.textContent = key;
      label.className = 'message-header-key';
      people.className = 'message-header-people';
      for (var i = 0; i < pairs.length; i++) {
        var pair = pairs[i],
            personNode = document.createElement('span'), nameNode;
        personNode.className = 'message-header-person';
        if (pair.name) {
          nameNode = document.createElement('span');
          nameNode.className = 'message-header-name';
          nameNode.textContent = pair.name;
          personNode.appendChild(nameNode);
        }
        var addressNode = document.createElement('span');
        addressNode.className = 'message-header-address';
        addressNode.textContent = pair.address;
        personNode.appendChild(addressNode);
        people.appendChild(personNode);
      }
      line.appendChild(label);
      line.appendChild(people);
      header.appendChild(line);
    }

    addHeaderEmails('from', [header.author]);
    if (mailBody.to && mailBody.to.length)
      addHeaderEmails('to', mailBody.to);
    if (mailBody.cc && mailBody.cc.length)
      addHeaderEmails('cc', mailBody.cc);
    if (mailBody.bcc && mailBody.bcc.length)
      addHeaderEmails('bcc', mailBody.bcc);

    var subject = header.appendChild(document.createElement('h2'));
    subject.className = 'message-frame-subject';
    subject.textContent = header.subject;

    nodes.messageFrame.body.textContent = mailBody.bodyText;
  },
  readMessage: function(domMessage) {
    var header = domMessage.header;
    header.getBody(function(body) {
      mail.populateMessageBodyDom(body);

      nodes.messageScreen.addEventListener('poppage', function popListener() {
        // (placeholder)
        this.removeEventListener('poppage', popListener);
      });

      mail.screens.moveToPage(nodes.messageScreen);
    });

    //console.log(nodes.messageScreen.hidden = false);

  },
  updatePages: function(page, dir) {
    var tmp,
      pages = mail.pages;

    page || (page = mail.currentPage);
    dir || (dir = mail.defaultDirection);

    if (tmp = pages[page - dir]) {
      tmp.style.display = 'block';
      tmp.style.MozTransform = Transform.translate(
        (window.innerWidth + TRANSITION_PADDING) * dir * -1
      );
    }

    if (tmp = pages[page + dir]) {
      if (!tmp.offsetWidth && !tmp.offsetHeight)
        nodes.messagesList.appendChild(tmp).style.display = 'block';

      tmp.style.MozTransform = Transform.translate(
        (window.innerWidth + TRANSITION_PADDING) * dir
      );
    }
  }
};

var nodes = {},
  loading = [],
  load = function(callback) {
    var fn = function() {
      if (loading.done) return null;

      let i = loading.indexOf(fn);
      i !== -1 && loading.splice(i, 1);

      let result = callback.apply(this, arguments);

      if (!loading.length) {
        loading.done = true;
        let event = new CustomEvent('apploaded');

        document.dispatchEvent(event);
      }
      return result;
    };

    loading.push(fn);

    return fn;
  };

document.addEventListener('DOMContentLoaded', load(function() {
  [
    'account-field',
    'account-bar',
    'folder-title',
    'messages-list',
    'message',
    'main',
    'first-screen',
    'folder-screen',
    'folders',
    'login-form',
    'select-exist-button',
    'mail-screen',
    'pre-mail-selected',
    'pre-select-mail',
    'select-account',
    'select-account-list',
    'message-screen',
    'message-frame',
  ].forEach(function(id) {
    var target = document.getElementById(id);

    if (target) {
      nodes[id.replace(/(?:-)(\w)/g, function(str, p) {
        return (p || '').toUpperCase();
      })] = target;
    }

  });

  let fields = document.querySelectorAll('.field');

  [].forEach.call(fields, function(field) {
    var cleanButton = field.querySelector('.clean-button'),
      input = field.querySelector('input'),
      valueSetter = input.__lookupSetter__('value'),
      valueGetter = input.__lookupGetter__('value'),
      handle = function() {
        if (this.value) {
          cleanButton.style.display = 'block';
        } else {
          cleanButton.style.display = 'none';
        }
        this.dispatchEvent(new CustomEvent('updatevalue'));
      };

      input.addEventListener('input', handle);
      input.addEventListener('overflow', handle);
      handle.call(input);

      cleanButton.addEventListener('click', function() {
        input.value = '';
        handle.call(input);
      });

      input.__defineSetter__('value', function(val) {
        valueSetter.call(this, val);
        handle.call(this);
        return val;
      });

      input.__defineGetter__('value', valueGetter);

  });

  let pages = document.querySelectorAll('.page');

  [].forEach.call(pages, function(page) {
    page.backButton = page.querySelector('.userbar .back-button');

    if (page.backButton) {
      page.backButton.addEventListener('click', function() {
        mail.screens.toPreviousPage();
      });
    }

    page.mainContent = page.querySelector('.main');

  });
}), true);

/*window.addEventListener('localized', load(function() {

  var html = document.documentElement,
    lang = document.mozL10n.language;

  html.setAttribute('lang', lang.code);
  html.setAttribute('dir', lang.direction);

  if (lang.direction === 'rtl') {
    mail.defaultDirection = -mail.defaultDirection;
  }

}));*/

//document.addEventListener('apploaded', function );

document.addEventListener('apploaded', function() {
    // This should ideally be kicked off prior to the apploaded notification.
    console.log('App Loaded, requesting Mail API');
    try {
      window.gimmeMailAPI(
        function(mailAPI) {
          console.log('Mail API acquired, loading first screen');
          MailAPI = mailAPI;
          mail.firstScreen();
        });
    }
    catch (ex) {
      console.error('Problem requesting Mail API', ex);
    }
  }, true);
