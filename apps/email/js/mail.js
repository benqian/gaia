/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

var MailAPI = null;

const PAGE_TRANSITION_DURATION = 300,
  CACHE_DOM_PAGES = 2,
  DEFAULT_DIRECTION = 1,
  MESSAGES_PER_SCREEN = 5,

  //simple regexp for parse addresses
  R_ADRESS_PARTS = /^(?:([\w\s]+) )?<(.+)>$/,

  STORE_ACCOUNTS_KEYS = 'mail:accounts';

var mail = {
  firstScreen: function() {

    const DOMAINS = {},
      R_EMAIL_DOMAIN = /@(.*)$/;

    //var pages = new Paging(nodes.firstScreen);

    //pages.registerPage(nodes.selectAccount);

    nodes.firstScreen.hidden = false;

    nodes.selectExistButton.addEventListener('click', function() {
      nodes.selectAccount.style.top = window.innerHeight + 'px';
      nodes.selectAccount.hidden = false;
      window.addEventListener('MozAfterPaint', function afterPaint() {
        window.removeEventListener('MozAfterPaint', afterPaint);

        Transition.run(nodes.selectAccount, {
          top: 0
        }, {
          duration: 300
        });

      });

      nodes.selectAccountList.innerHTML = '';

      var accountsSlice = MailAPI.viewAccounts();
      // XXX hookup and use onadd/onremove instead...
      accountsSlice.onsplice = function(index, howMany, addedItems, requested,
                                        moreExpected) {
        // - (dynamically) removed accounts
        // (This should really only happen on the settings page.)
        if (howMany) {
          for (var i = index + howMany - 1; i >= index; i--) {
            var account = accountsSlice.items[i];
            account.element.parentNode.removeChild(account.element);
          }
        }

        // - added/existing accounts
        addedItems.forEach(function(account) {
          var li = account.element = document.createElement('li');
          //li.dataset.index = i;

          li.addEventListener('click', function() {
            window.removeEventListener('keyup', ESCLitener);
            nodes.firstScreen.hidden = true;
            mail.findAndShowAccountInbox(account);
          });

          nodes.selectAccountList.appendChild(
            li
          ).appendChild(
            document.createElement('h2')
          ).textContent = account;
        });
      };

      window.addEventListener('keyup', ESCLitener);

      function ESCLitener(e) {
        if (e.keyCode === e.DOM_VK_ESCAPE) {
          e.preventDefault();
          Transition.stop(nodes.selectAccount);
          Transition.run(nodes.selectAccount, {
           top: window.innerHeight + 'px'
          }, {
            duration: 300
          });
          window.removeEventListener('keyup', ESCLitener);
        }
      }

    });

    nodes.loginForm.addEventListener('submit', function(e) {

      var emailAddress = this.account.value,
        password = this.password.value;

      e.preventDefault();

      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }

      nodes.firstScreen.hidden = true;

      MailAPI.tryToCreateAccount(
          {
            host: 'localhost',
            port: 993,
            crypto: 'ssl',
            username: emailAddress,
            password: password,
          },
          function(err) {
            if (err) {
              // XXX display feedback if there was an error.
              return;
            }
            // (account was successfully created)
            mail.findAndShowAccountInbox(null);
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


      {
        let account = nodes.loginForm.account,
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

      };

      e.preventDefault();

    });

    nodes.preSelectMail.addEventListener('mousedown', function(e) {
      e.preventDefault();
    }, true);

  },
  // Hack to get the list of folders, pick the inbox corresponding to the
  // inbox for the account requested/implied-by-username, and then show that
  // folder's contents on the mailScreen.
  //
  // In the real implementation, the user would be presented with the list
  // of folders and then display those, so this function would not exist.
  findAndShowAccountInbox: function(account) {
    var foldersSlice = MailAPI.viewFolders();
    foldersSlice.onsplice = function(index, howMany, addedItems, requested,
                                     moreExpected) {
      var useNextInbox = (account === null);
      for (var i = 0; i < addedItems.length; i++) {
        var folder = addedItems[i];
        if (useNextInbox && folder.type === 'inbox') {
          mail.mailScreen(folder);
          break;
        }
        if (folder.id === account.id)
          useNextInbox = true;
      }
    };
  },
  mailScreen: function(folder) {
    var msgSlice = MailAPI.viewFolderMessages(folder);
    
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
        var insertBuddy = (index >= nodes.messageList.childElementCount) ?
                            null : nodes.messagesList.children[index];
        addedItems.forEach(function(message) {
          var domMessage = message.element = mail.messageConstructor(message);
          nodes.messageList.insertBefore(domMessage, insertBuddy);
        });
      };

    var swipedTarget,
      swipeMove = function() {

      },
      swipeEnd = function() {

        swipedTarget = null;
        document.removeEventListener('mousemove', swipeMove);
        document.removeEventListener('swipeend', swipeEnd);

      },
      getMessage = function(target){

        while (!('messageId' in target.dataset)) {

          if ((target = target.parentNode) === nodes.mailScreen) {
            return null;
          };
          
        }

        return target;

      };

    nodes.mailScreen.hidden = false;

    nodes.accountBar
      .appendChild(document.createElement('div'))
      .appendChild(document.createElement('span'))
      .textContent = account;

    nodes.mailScreen.addEventListener('mousedown', function(e) {
      swipedTarget = getMessage(e.target);

      if(!swipedTarget) {
        return;
      }

      let left = e.layerX,
        width = swipedTarget.offsetWidth,
        started = false;

      document.addEventListener('tapstart', function() {
        swipedTarget.classList.add('highlight');
      });

      if (left > width - width / 10) {
        document.addEventListener('swipestart', function listenStart(e) {
          if (e.detail & SWIPE_HORIZONTAL) {
            console.log('swipe');
            document.addEventListener('mousemove', function(e) {
              console.log('move');
              if (!started && left - e.layerX > width / 3) {
                started = true;
              }

              if (started) {

              }
            });
          }
        });
        document.addEventListener('mouseup', function() {

        });
      }

    }, true);

    nodes.main.addEventListener('tapstart', function(e) {
      console.log('tapstart');
    });
    nodes.main.addEventListener('tapend', function(e) {
      console.log('tapend');
    });
    nodes.main.addEventListener('longtapstart', function(e) {
      console.log('longtap');
    });

  },
  folder: 'inbox',
  defaultDirection: DEFAULT_DIRECTION,
  folderMessages: null,
  messagesList: (function(){

    var memmoryStack = {};

    return {
      getById: function(){

      },
      updateList: function(){

      },
      clearList: function(){

      }
    };
  }()),
  messageConstructor: function(data) {
    var message = document.createElement('article');

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
    'folder',
    'messages-list',
    'messages',
    'main',
    'first-screen',
    'login-form',
    'select-exist-button',
    'mail-screen',
    'pre-mail-selected',
    'pre-select-mail',
    'select-account',
    'select-account-list'
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
