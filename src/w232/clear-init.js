// Generated by LiveScript 1.4.0
var ref$, sleep, waitFor, timeoutWaitFor, go, isWaiting, merge, unpack, pack, repl, config, debugLog, http, getLogger, i, genReqId, slice$ = [].slice;
ref$ = require('../lib/aea'), sleep = ref$.sleep, waitFor = ref$.waitFor, timeoutWaitFor = ref$.timeoutWaitFor, go = ref$.go, isWaiting = ref$.isWaiting, merge = ref$.merge, unpack = ref$.unpack, pack = ref$.pack, repl = ref$.repl, config = ref$.config, debugLog = ref$.debugLog;
http = require('http');
function alignLeft(width, inp){
  var x;
  return x = (inp + repeatString$(" ", width)).slice(0, width);
}
getLogger = function(src){
  return function(){
    var x;
    x = slice$.call(arguments);
    return debugLog.call(this, alignLeft(15, src + "") + ":" + x.join(''));
  };
};
i = 0;
genReqId = function(digit){
  return i++;
};
function LongPolling(settings){
  this.settings = settings;
  this.content = {
    node: this.settings.id
  };
  this.events = {
    error: [],
    connect: [],
    disconnect: [],
    data: []
  };
  this.connected = false;
  this.connecting = false;
  this.reconnectInterval = 1000;
}
LongPolling.prototype.on = function(event, callback){
  var ref$;
  return (ref$ = this.events)[event] = ref$[event].concat(callback);
};
LongPolling.prototype.trigger = function(name){
  var event, i$, x$, ref$, len$, results$ = [];
  event = slice$.call(arguments, 1);
  for (i$ = 0, len$ = (ref$ = this.events[name]).length; i$ < len$; ++i$) {
    x$ = ref$[i$];
    if (typeof x$ === 'function') {
      results$.push(x$.apply(this, event));
    }
  }
  return results$;
};
LongPolling.prototype.send = function(msg, callback){
  var log, e;
  log = getLogger('SEND');
  try {
    if (!this.connected) {
      throw 'you MUST connect first!';
    }
    this.postRaw({
      data: msg
    }, callback);
    return log("WARNING: not calling callback!");
  } catch (e$) {
    e = e$;
    log("error: ", e);
    return callback(e, null);
  }
};
LongPolling.prototype.getRaw = function(){
  var i$, query, callback, __, log, queryStr, key, value, e;
  query = 0 < (i$ = arguments.length - 1) ? slice$.call(arguments, 0, i$) : (i$ = 0, []), callback = arguments[i$];
  query = query[0];
  __ = this;
  log = getLogger('GET_RAW');
  try {
    if (!this.connected) {
      throw 'not connected';
    }
    queryStr = "?" + (function(){
      var ref$, results$ = [];
      for (key in ref$ = query) {
        value = ref$[key];
        results$.push(key + "=" + value);
      }
      return results$;
    }()).join("&");
    log(queryStr);
    return sleep(0, function(){
      var options, requestId, req;
      options = {
        host: __.settings.host,
        port: __.settings.port,
        method: 'GET',
        path: __.settings.sociPath + queryStr
      };
      requestId = genReqId(3);
      log("new request: ", requestId);
      req = http.get(options, function(res){
        res.on('data', function(data){
          log("got data: ", data);
          return callback(null, data);
        });
        res.on('error', function(){
          return log(requestId + " Response Error: ", err);
        });
        return res.on('close', function(){
          return log(requestId + " request is closed by server... ");
        });
      });
      return req.on('error', function(err){
        log("req #" + requestId + " has error: ", err);
        return sleep(1000, function(){
          return __.connect();
        });
      });
    });
  } catch (e$) {
    e = e$;
    log("get-raw returned with error: ", e);
    callback(e, null);
    return __.connect();
  }
};
LongPolling.prototype.postRaw = function(msg, callback){
  var __, log, err, content, contentStr, options, requestId, req;
  __ = this;
  log = getLogger("POST_RAW");
  err = false;
  content = merge(this.content, msg);
  contentStr = pack(content);
  options = {
    host: this.settings.host,
    port: this.settings.port,
    method: 'POST',
    path: this.settings.sicoPath,
    headers: {
      "Content-Type": "application/json",
      "Content-Length": contentStr.length
    }
  };
  requestId = genReqId(3);
  log("New POST request: ", requestId);
  req = http.request(options, function(res){
    res.on('data', function(data){
      var e;
      log(requestId + " got data: ", data);
      try {
        return callback(null, unpack(data));
      } catch (e$) {
        e = e$;
        log("CAN NOT UNPACK DATA: ", data);
        return log("err: ", e);
      }
    });
    res.on('error', function(){
      return log(requestId + " Response Error: ", err);
    });
    return res.on('close', function(){
      return log(requestId + " request is closed by server... ");
    });
  });
  req.on('error', function(err){
    log(requestId + " Request Error: ", err);
    __.connected = false;
    __.trigger('error', err);
    callback(err, null);
    log("trying to reconnect in " + __.reconnectInterval + "ms...");
    return sleep(__.reconnectInterval, function(){
      return __.connect();
    });
  });
  req.write(contentStr);
  return req.end();
};
LongPolling.prototype.connect = function(nextStep){
  var __, log;
  __ = this;
  log = getLogger('CONNECT');
  if (this.connecting) {
    log("Already started...");
    return;
  }
  this.connecting = true;
  this.connected = false;
  log("Trying to connect to server...");
  return __.postRaw({
    ack: "200"
  }, function(err, data){
    var e;
    if (!err) {
      try {
        if (data.ack !== 'OK') {
          throw "not my server!";
        }
        log("Connection seems ok, starting all tasks...");
        sleep(0, function(){
          __.connected = true;
          __.receiveLoop();
          if (typeof nextStep === 'function') {
            return nextStep();
          }
        });
      } catch (e$) {
        e = e$;
        log("Error: ", e);
        log("Retrying in " + __.reconnectInterval + "ms...");
        sleep(__.reconnectInterval, function(){
          return __.connect();
        });
      }
    }
    return __.connecting = false;
  });
};
LongPolling.prototype.receiveLoop = function(){
  var __, log;
  __ = this;
  log = getLogger('RECEIVE_LOOP');
  log("starting...");
  return function lo(op){
    var receiverId;
    receiverId = genReqId(3);
    return __.getRaw(function(err, res){
      if (err) {
        log(receiverId + " has Error: ", err);
        __.trigger('error', err);
        log("Breaking receive loop...");
        return op();
      } else {
        log(receiverId + " got data...", res);
        __.trigger('data', res);
        return lo(op);
      }
    });
  }(function(){});
};
function init(){
  var log, comm, x$;
  log = getLogger('MAIN');
  comm = new LongPolling({
    host: 'localhost',
    port: 5656,
    sicoPath: '/send',
    sociPath: '/receive',
    id: 'abc123'
  });
  x$ = comm;
  x$.on('error', function(err){
    return log("COMM-ERR:: ", err);
  });
  x$.on('connect', function(info){
    return log("Connected to server. Server info: ", info);
  });
  x$.on('disconnect', function(){
    return log("Disconnected from server!!!");
  });
  x$.on('data', function(data){
    return log("Received DATA: ", data);
  });
  return comm.getRaw({
    hello: 'world'
  }, function(err, res){
    log("get raw returned with err, res: ", err, res);
    return comm.send({
      mydata: 'hello'
    }, function(err){
      log("send hello: ", err);
      return comm.connect(function(){
        log("it seems connection is ok, continuing...");
        return;
        return function lo(op){
          return;
          return comm.send({
            temperature: Math.random()
          }, function(err){
            if (err) {
              log("We couldn't send to data because: ", err);
            }
            return timeoutWaitFor(10000, 'temperature-measured', function(){
              return lo(op);
            });
          });
        }(function(){});
      });
    });
  });
} init();
function repeatString$(str, n){
  for (var r = ''; n > 0; (n >>= 1) && (str += str)) if (n & 1) r += str;
  return r;
}