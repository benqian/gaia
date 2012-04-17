/**
 * Created by JetBrains WebStorm.
 * User: nekr
 * Date: 4/15/12
 * Time: 10:33 PM
 * To change this template use File | Settings | File Templates.
 */

const
  SWIPE_OFFSET = 30,
  SWIPE_ANIMATION = 400,
  SWIPE_HORIZONTAL = 1,
  SWIPE_VERTICAL = 2,
  SWIPE_BOTH = 3,
  TAP_DELAY = 100,
  LONG_TAP_DELAY = 500;

document.addEventListener('mousedown', function(e){
  //console.log(e.clientX);
  var upListener = function(e){
      if(swipeMap){

        let swipe = new MouseEvent('swipeend', e);
        e.target.dispatchEvent(swipe);

      }else if(!tapDispatched){

        waitTap();

        let (tapend = new MouseEvent('tapend', e)){
          e.target.dispatchEvent(tapend);
        }

      }
      //console.log('up listener');
      document.removeEventListener('mouseup', upListener);
      document.removeEventListener('mousemove', moveListener);
      tapTimer && window.clearTimeout(tapTimer);
      longTapTimer && window.clearTimeout(longTapTimer);
      tapTimer = longTapTimer = null;
      swipeMap = 0;
    },
    moveListener = function(e){
      if(!(swipeMap & SWIPE_HORIZONTAL) && Math.abs(startX - e.clientX) > SWIPE_OFFSET){
       // console.log('in');
        swipeMap |= SWIPE_HORIZONTAL;
        Object.defineProperty(e, 'detail', {
          value: SWIPE_HORIZONTAL,
          configurable: true
        });
        //console.log(e.clientX);
        let swipe = new MouseEvent('swipestart', e);
        e.target.dispatchEvent(swipe);
       // console.log(swipeMap + 'a');
      }

      if(!(swipeMap & SWIPE_VERTICAL) && Math.abs(startY - e.clientY) > SWIPE_OFFSET){
        swipeMap |= SWIPE_VERTICAL;
        Object.defineProperty(e, 'detail', {
          value: SWIPE_VERTICAL,
          configurable: true
        });
        let swipe = new MouseEvent('swipestart', e);
        e.target.dispatchEvent(swipe);
      }

      latestEvent = e;

    },
    startX = e.clientX,
    startY = e.clientY,

    // 1 - horizontal
    // 2 - vertical
    // 3 - both
    swipeMap = 0,
    tapTimer = 0,
    longTapTimer = 0,
    latestEvent,
    tapDispatched,
    waitTap = function(){
      if(swipeMap) return;

      var tap = new MouseEvent('tapstart', latestEvent || e);
      e.target.dispatchEvent(tap);
      tapTimer = null;
      tapDispatched = true;
    };


  document.addEventListener('mouseup', upListener);
  document.addEventListener('mousemove', moveListener);

  tapTimer = window.setTimeout(waitTap, TAP_DELAY);
  longTapTimer = window.setTimeout(function(){
    if(swipeMap || tapTimer) return;
    var tap = new MouseEvent('longtapstart', latestEvent || e);
    e.target.dispatchEvent(tap);
    longTapTimer = null;

  }, LONG_TAP_DELAY);
  //e.stopImmediatePropagation();
  //e.preventDefault();
}, true);