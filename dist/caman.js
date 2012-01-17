(function() {
  var $, Blender, Calculate, CamanInstance, Convert, Event, Filter, IO, Layer, Log, Logger, PixelInfo, Plugin, RenderJob, Root, Store, Util, slice,
    __hasProp = Object.prototype.hasOwnProperty,
    __indexOf = Array.prototype.indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  slice = Array.prototype.slice;

  $ = function(sel, root) {
    if (root == null) root = document;
    if (typeof sel === "object") return sel;
    return root.querySelector(sel);
  };

  Util = (function() {

    function Util() {}

    Util.uniqid = (function() {
      var id;
      id = 0;
      return {
        get: function() {
          return id++;
        }
      };
    })();

    Util.extend = function(obj) {
      var copy, dest, prop, src, _i, _len;
      dest = obj;
      src = slice.call(arguments, 1);
      for (_i = 0, _len = src.length; _i < _len; _i++) {
        copy = src[_i];
        for (prop in copy) {
          if (!__hasProp.call(copy, prop)) continue;
          dest[prop] = copy[prop];
        }
      }
      return dest;
    };

    Util.clampRGB = function(val) {
      if (val < 0) return 0;
      if (val > 255) return 255;
      return val;
    };

    return Util;

  })();

  Root = typeof exports !== "undefined" && exports !== null ? exports : window;

  Root.Caman = function() {
    var tag;
    switch (arguments.length) {
      case 1:
        if (Store.has(arguments[0])) return Store.get(arguments[0]);
        return new CamanInstance(arguments, CamanInstance.Type.Image);
      case 2:
        if (Store.has(arguments[0])) {
          return Store.execute(arguments[0], arguments[1]);
        }
        if (typeof arguments[1] === 'function') {
          tag = $(arguments[0]).nodeName.toLowerCase();
          if (tag === "img") {
            return new CamanInstance(arguments, CamanInstance.Type.Image);
          }
          if (tag === "canvas") {
            return new CamanInstance(arguments, CamanInstance.Type.Canvas);
          }
        } else {
          return new CamanInstance(arguments, CamanInstance.Type.Canvas);
        }
        break;
      case 3:
        if (Store.has(arguments[0])) {
          return Store.execute(arguments[1], arguments[2]);
        }
        return new CamanInstance(arguments, CamanInstance.Type.Canvas);
    }
  };

  Caman.version = {
    release: "3.0",
    date: "1/2/12"
  };

  Caman.DEBUG = false;

  Caman.toString = function() {
    return "Version " + Caman.version.release + ", Released " + Caman.version.date;
  };

  Caman.remoteProxy = "";

  Caman.Util = Util;

  CamanInstance = (function() {

    CamanInstance.Type = {
      Image: 1,
      Canvas: 2
    };

    CamanInstance.toString = Caman.toString;

    function CamanInstance(args, type) {
      if (type == null) type = CamanInstance.Type.Canvas;
      this.id = Util.uniqid.get();
      this.pixelStack = [];
      this.layerStack = [];
      this.renderQueue = [];
      this.canvasQueue = [];
      switch (type) {
        case CamanInstance.Type.Image:
          this.loadImage.apply(this, args);
          break;
        case CamanInstance.Type.Canvas:
          this.loadCanvas.apply(this, args);
      }
    }

    CamanInstance.prototype.loadImage = function(id, callback) {
      var element, image, proxyURL, _ref,
        _this = this;
      if (callback == null) callback = function() {};
      if (typeof id === "object" && ((_ref = id.nodeName) != null ? _ref.toLowerCase() : void 0) === "img") {
        element = id;
        if (id.id) {
          id = element.id;
        } else {
          id = "caman-" + (Util.uniqid.get());
          element.id = id;
        }
      }
      if ($(id) != null) {
        image = $(id);
        proxyURL = IO.remoteCheck(image.src);
        if (proxyURL) {
          image.onload = function() {
            return _this.imageLoaded(id, image, callback);
          };
          return image.src = proxyURL;
        } else {
          if (image.complete) {
            return this.imageLoaded(id, image, callback);
          } else {
            return image.onload = function() {
              return _this.imageLoaded(id, image, callback);
            };
          }
        }
      }
    };

    CamanInstance.prototype.imageLoaded = function(id, image, callback) {
      var attr, _i, _len, _ref;
      this.image = image;
      this.canvas = document.createElement('canvas');
      this.canvas.id = image.id;
      _ref = ['data-camanwidth', 'data-camanheight'];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        attr = _ref[_i];
        if (this.image.getAttribute(attr)) {
          this.canvas.setAttribute(attr, this.image.getAttribute(attr));
        }
      }
      image.parentNode.replaceChild(this.canvas, this.image);
      this.canvasID = id;
      this.options = {
        canvas: id,
        image: this.image.src
      };
      return this.finishInit(callback);
    };

    CamanInstance.prototype.loadCanvas = function(url, id, callback) {
      var element, _ref,
        _this = this;
      if (callback == null) callback = function() {};
      if (typeof id === "object" && ((_ref = id.nodeName) != null ? _ref.toLowerCase() : void 0) === "canvas") {
        element = id;
        if (id.id) {
          id = element.id;
        } else {
          id = "caman-" + (Util.uniqid.get());
          element.id = id;
        }
      }
      if ($(id) != null) {
        return this.canvasLoaded(url, id, callback);
      } else {
        return document.addEventListener("DOMContentLoaded", function() {
          return _this.canvasLoaded(url, id, callback);
        }, false);
      }
    };

    CamanInstance.prototype.canvasLoaded = function(url, id, callback) {
      var proxyURL,
        _this = this;
      this.canvas = $(id);
      if (url != null) {
        this.image = document.createElement('img');
        this.image.onload = function() {
          return _this.finishInit(callback);
        };
        proxyURL = IO.remoteCheck(url);
        this.canvasID = id;
        this.options = {
          canvas: id,
          image: url
        };
        return this.image.src = proxyURL ? proxyURL : url;
      } else {
        return this.finishInit(callback);
      }
    };

    CamanInstance.prototype.finishInit = function(callback) {
      var newHeight, newWidth, oldHeight, oldWidth;
      this.context = this.canvas.getContext("2d");
      if (this.image != null) {
        oldWidth = this.image.width;
        oldHeight = this.image.height;
        newWidth = this.canvas.getAttribute('data-camanwidth');
        newHeight = this.canvas.getAttribute('data-camanheight');
        if (newWidth || newHeight) {
          if (newWidth) {
            this.image.width = parseInt(newWidth, 10);
            if (newHeight) {
              this.image.height = parseInt(newHeight, 10);
            } else {
              this.image.height = this.image.width * oldHeight / oldWidth;
            }
          } else if (newHeight) {
            this.image.height = parseInt(newHeight, 10);
            this.image.width = this.image.height * oldWidth / oldHeight;
          }
        }
        this.canvas.width = this.image.width;
        this.canvas.height = this.image.height;
        this.context.drawImage(this.image, 0, 0, this.image.width, this.image.height);
      }
      this.imageData = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
      this.pixelData = this.imageData.data;
      this.dimensions = {
        width: this.canvas.width,
        height: this.canvas.height
      };
      Store.put(this.canvasID, this);
      callback.call(this, this);
      return this;
    };

    return CamanInstance;

  })();

  Blender = (function() {

    function Blender() {}

    Blender.blenders = {};

    Blender.register = function(name, func) {
      return this.blenders[name] = func;
    };

    Blender.execute = function(name, rgbaLayer, rgbaParent) {
      return this.blenders[name](rgbaLayer, rgbaParent);
    };

    return Blender;

  })();

  Caman.Blender = Blender;

  Calculate = (function() {

    function Calculate() {}

    Calculate.distance = function(x1, y1, x2, y2) {
      return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    };

    Calculate.randomRange = function(min, max, float) {
      var rand;
      if (float == null) float = false;
      rand = min + (Math.random() * (max - min));
      if (float) {
        return rand.toFixed(float);
      } else {
        return Math.round(rand);
      }
    };

    Calculate.bezier = function(start, ctrl1, ctrl2, end, lowBound, highBound) {
      var Ax, Ay, Bx, By, Cx, Cy, bezier, curveX, curveY, i, j, leftCoord, rightCoord, t, x0, x1, x2, x3, y0, y1, y2, y3, _ref, _ref2;
      x0 = start[0];
      y0 = start[1];
      x1 = ctrl1[0];
      y1 = ctrl1[1];
      x2 = ctrl2[0];
      y2 = ctrl2[1];
      x3 = end[0];
      y3 = end[1];
      bezier = {};
      Cx = 3 * (x1 - x0);
      Bx = 3 * (x2 - x1) - Cx;
      Ax = x3 - x0 - Cx - Bx;
      Cy = 3 * (y1 - y0);
      By = 3 * (y2 - y1) - Cy;
      Ay = y3 - y0 - Cy - By;
      for (i = 0; i < 1000; i++) {
        t = i / 1000;
        curveX = Math.round((Ax * Math.pow(t, 3)) + (Bx * Math.pow(t, 2)) + (Cx * t) + x0);
        curveY = Math.round((Ay * Math.pow(t, 3)) + (By * Math.pow(t, 2)) + (Cy * t) + y0);
        if (lowBound && curveY < lowBound) {
          curveY = lowBound;
        } else if (highBound && curveY > highBound) {
          curveY = highBound;
        }
        bezier[curveX] = curveY;
      }
      if (bezier.length < end[0] + 1) {
        for (i = 0, _ref = end[0]; 0 <= _ref ? i <= _ref : i >= _ref; 0 <= _ref ? i++ : i--) {
          if (!(bezier[i] != null)) {
            leftCoord = [i - 1, bezier[i - 1]];
            for (j = i, _ref2 = end[0]; i <= _ref2 ? j <= _ref2 : j >= _ref2; i <= _ref2 ? j++ : j--) {
              if (bezier[j] != null) {
                rightCoord = [j, bezier[j]];
                break;
              }
            }
            bezier[i] = leftCoord[1] + ((rightCoord[1] - leftCoord[1]) / (rightCoord[0] - leftCoord[0])) * (i - leftCoord[0]);
          }
        }
      }
      if (!(bezier[end[0]] != null)) bezier[end[0]] = bezier[end[0] - 1];
      return bezier;
    };

    return Calculate;

  })();

  Convert = (function() {

    function Convert() {}

    Convert.hexToRGB = function(hex) {
      var b, g, r;
      if (hex.charAt(0) === "#") hex = hex.substr(1);
      r = parseInt(hex.substr(0, 2), 16);
      g = parseInt(hex.substr(2, 2), 16);
      b = parseInt(hex.substr(4, 2), 16);
      return {
        r: r,
        g: g,
        b: b
      };
    };

    Convert.rgbToHSL = function(r, g, b) {
      var d, h, l, max, min, s;
      r /= 255;
      g /= 255;
      b /= 255;
      max = Math.max(r, g, b);
      min = Math.min(r, g, b);
      l = (max + min) / 2;
      if (max === min) {
        h = s = 0;
      } else {
        d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        h = (function() {
          switch (max) {
            case r:
              return (g - b) / d + (g < b ? 6 : 0);
            case g:
              return (b - r) / d + 2;
            case b:
              return (r - g) / d + 4;
          }
        })();
        h /= 6;
      }
      return {
        h: h,
        s: s,
        l: l
      };
    };

    Convert.hslToRGB = function(h, s, l) {
      var b, g, p, q, r;
      if (s === 0) {
        r = g = b = l;
      } else {
        q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        p = 2 * l - q;
        r = this.hueToRGB(p, q, h + 1 / 3);
        g = this.hueToRGB(p, q, h);
        b = this.hueToRGB(p, q, h - 1 / 3);
      }
      return {
        r: r * 255,
        g: g * 255,
        b: b * 255
      };
    };

    Convert.hueToRGB = function(p, q, t) {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    Convert.rgbToHSV = function(r, g, b) {
      var d, h, max, min, s, v;
      r /= 255;
      g /= 255;
      b /= 255;
      max = Math.max(r, g, b);
      min = Math.min(r, g, b);
      v = max;
      d = max - min;
      s = max === 0 ? 0 : d / max;
      if (max === min) {
        h = 0;
      } else {
        h = (function() {
          switch (max) {
            case r:
              return (g - b) / d + (g < b ? 6 : 0);
            case g:
              return (b - r) / d + 2;
            case b:
              return (r - g) / d + 4;
          }
        })();
        h /= 6;
      }
      return {
        h: h,
        s: s,
        v: v
      };
    };

    Convert.hsvToRGB = function(h, s, v) {
      var b, f, g, i, p, q, r, t;
      i = Math.floor(h * 6);
      f = h * 6 - i;
      p = v * (1 - s);
      q = v * (1 - f * s);
      t = v * (1 - (1 - f) * s);
      switch (i % 6) {
        case 0:
          r = v;
          g = t;
          b = p;
          break;
        case 1:
          r = q;
          g = v;
          b = p;
          break;
        case 2:
          r = p;
          g = v;
          b = t;
          break;
        case 3:
          r = p;
          g = q;
          b = v;
          break;
        case 4:
          r = t;
          g = p;
          b = v;
          break;
        case 5:
          r = v;
          g = p;
          b = q;
      }
      return {
        r: r * 255,
        g: g * 255,
        b: b * 255
      };
    };

    Convert.rgbToXYZ = function(r, g, b) {
      var x, y, z;
      r /= 255;
      g /= 255;
      b /= 255;
      if (r > 0.04045) {
        r = Math.pow((r + 0.055) / 1.055, 2.4);
      } else {
        r /= 12.92;
      }
      if (g > 0.04045) {
        g = Math.pow((g + 0.055) / 1.055, 2.4);
      } else {
        g /= 12.92;
      }
      if (b > 0.04045) {
        b = Math.pow((b + 0.055) / 1.055, 2.4);
      } else {
        b /= 12.92;
      }
      x = r * 0.4124 + g * 0.3576 + b * 0.1805;
      y = r * 0.2126 + g * 0.7152 + b * 0.0722;
      z = r * 0.0193 + g * 0.1192 + b * 0.9505;
      return {
        x: x * 100,
        y: y * 100,
        z: z * 100
      };
    };

    Convert.xyzToRGB = function(x, y, z) {
      var b, g, r;
      x /= 100;
      y /= 100;
      z /= 100;
      r = (3.2406 * x) + (-1.5372 * y) + (-0.4986 * z);
      g = (-0.9689 * x) + (1.8758 * y) + (0.0415 * z);
      b = (0.0557 * x) + (-0.2040 * y) + (1.0570 * z);
      if (r > 0.0031308) {
        r = (1.055 * Math.pow(r, 0.4166666667)) - 0.055;
      } else {
        r *= 12.92;
      }
      if (g > 0.0031308) {
        g = (1.055 * Math.pow(g, 0.4166666667)) - 0.055;
      } else {
        g *= 12.92;
      }
      if (b > 0.0031308) {
        b = (1.055 * Math.pow(b, 0.4166666667)) - 0.055;
      } else {
        b *= 12.92;
      }
      return {
        r: r * 255,
        g: g * 255,
        b: b * 255
      };
    };

    Convert.xyzToLab = function(x, y, z) {
      var a, b, l, whiteX, whiteY, whiteZ;
      whiteX = 95.047;
      whiteY = 100.0;
      whiteZ = 108.883;
      x /= whiteX;
      y /= whiteY;
      z /= whiteZ;
      if (x > 0.008856451679) {
        x = Math.pow(x, 0.3333333333);
      } else {
        x = (7.787037037 * x) + 0.1379310345;
      }
      if (y > 0.008856451679) {
        y = Math.pow(y, 0.3333333333);
      } else {
        y = (7.787037037 * y) + 0.1379310345;
      }
      if (z > 0.008856451679) {
        z = Math.pow(z, 0.3333333333);
      } else {
        z = (7.787037037 * z) + 0.1379310345;
      }
      l = 116 * y - 16;
      a = 500 * (x - y);
      b = 200 * (y - z);
      return {
        l: l,
        a: a,
        b: b
      };
    };

    Convert.labToXYZ = function(l, a, b) {
      var x, y, z;
      y = (l + 16) / 116;
      x = y + (a / 500);
      z = y - (b / 200);
      if (x > 0.2068965517) {
        x = x * x * x;
      } else {
        x = 0.1284185493 * (x - 0.1379310345);
      }
      if (y > 0.2068965517) {
        y = y * y * y;
      } else {
        y = 0.1284185493 * (y - 0.1379310345);
      }
      if (z > 0.2068965517) {
        z = z * z * z;
      } else {
        z = 0.1284185493 * (z - 0.1379310345);
      }
      return {
        x: x * 95.047,
        y: y * 100.0,
        z: z * 108.883
      };
    };

    return Convert;

  })();

  Event = (function() {

    function Event() {}

    Event.events = {};

    Event.types = ["processStart", "processComplete", "renderFinished"];

    Event.trigger = function(target, type, data) {
      var event, _i, _len, _ref, _results;
      if (this.events[type] && this.events[type].length) {
        _ref = this.events[type];
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          event = _ref[_i];
          if (event.target === null || target.id === event.target.id) {
            _results.push(event.fn.call(target, data));
          } else {
            _results.push(void 0);
          }
        }
        return _results;
      }
    };

    Event.listen = function(target, type, fn) {
      var _fn, _type;
      if (typeof target === "string") {
        _type = target;
        _fn = type;
        target = null;
        type = _type;
        fn = _fn;
      }
      if (__indexOf.call(this.types, type) < 0) return false;
      if (!this.events[type]) this.events[type] = [];
      this.events[type].push({
        target: target,
        fn: fn
      });
      return true;
    };

    return Event;

  })();

  Caman.Event = Event;

  Filter = (function() {

    function Filter() {}

    Filter.Type = {
      Single: 1,
      Kernel: 2,
      LayerDequeued: 3,
      LayerFinished: 4,
      LoadOverlay: 5,
      Plugin: 6
    };

    Filter.register = function(name, filterFunc) {
      return CamanInstance.prototype[name] = filterFunc;
    };

    Filter.prototype.render = function(callback) {
      var _this = this;
      if (callback == null) callback = function() {};
      return this.processNext(function() {
        _this.context.putImageData(_this.imageData, 0, 0);
        return callback.call(_this);
      });
    };

    Filter.prototype.process = function(name, processFn) {
      this.renderQueue.push({
        type: Filter.Type.Single,
        name: name,
        processFn: processFn
      });
      return this;
    };

    Filter.prototype.processKernel = function(name, adjust, divisor, bias) {
      var i, _ref;
      if (!divisor) {
        divisor = 0;
        for (i = 0, _ref = adjust.length; 0 <= _ref ? i < _ref : i > _ref; 0 <= _ref ? i++ : i--) {
          divisor += adjust[i];
        }
      }
      this.renderQueue.push({
        type: Filter.Type.Kernel,
        name: name,
        adjust: adjust,
        divisor: divisor,
        bias: bias || 0
      });
      return this;
    };

    Filter.prototype.processPlugin = function(plugin, args) {
      this.renderQueue.push({
        type: Filter.Type.Plugin,
        plugin: plugin,
        args: args
      });
      return this;
    };

    Filter.prototype.processNext = function(finishedFn) {
      var next,
        _this = this;
      if (typeof finishedFn === "function") this.finishedFn = finishedFn;
      if (this.renderQueue.length === 0) {
        if (this.finishedFn != null) {
          Event.trigger(this, "renderFinished");
          this.finishedFn.call(this);
        }
        return this;
      }
      next = this.renderQueue.shift();
      return RenderJob.execute(this, next, function() {
        return _this.processNext();
      });
    };

    Filter.prototype.newLayer = function(callback) {
      var layer;
      layer = new Layer(this);
      this.canvasQueue.push(layer);
      this.renderQueue.push({
        type: Filter.Type.LayerDequeue
      });
      callback.call(layer);
      this.renderQueue.push({
        type: Filter.Type.LayerFinished
      });
      return this;
    };

    Filter.prototype.executeLayer = function(layer) {
      this.pushContext(layer);
      return this.processNext();
    };

    Filter.prototype.pushContext = function(layer) {
      this.layerStack.push(this.currentLayer);
      this.pixelStack.push(this.pixelData);
      this.currentLayer = layer;
      return this.pixelData = layer.pixelData;
    };

    Filter.prototype.popContext = function() {
      this.pixelData = this.pixelStack.pop();
      return this.currentLayer = this.layerStack.pop();
    };

    Filter.prototype.applyCurrentLayer = function() {
      return this.currentLayer.applyToParent();
    };

    return Filter;

  })();

  Util.extend(CamanInstance.prototype, Filter.prototype);

  Caman.Filter = Filter;

  IO = (function() {

    function IO() {}

    IO.domainRegex = /(?:(?:http|https):\/\/)((?:\w+)\.(?:(?:\w|\.)+))/;

    IO.isRemote = function(url) {
      var matches;
      if (!url) return;
      matches = url.match(this.domainRegex);
      if (matches) {
        return matches[1] !== document.domain;
      } else {
        return false;
      }
    };

    IO.remoteCheck = function(src) {
      if (this.isRemote(src)) {
        if (!Caman.remoteProxy.length) {
          Log.info("Attempting to load a remote image without a configured proxy. URL: " + src);
        } else {
          if (Caman.isRemote(Caman.remoteProxy)) {
            Log.info("Cannot use a remote proxy for loading images.");
            return;
          }
          return "" + Caman.remoteProxy + "?camanProxyUrl=" + (encodeURIComponent(src));
        }
      }
    };

    IO.useProxy = function(lang) {
      var langToExt;
      langToExt = {
        ruby: 'rb',
        python: 'py',
        perl: 'pl',
        javascript: 'js'
      };
      lang = lang.toLowerCase();
      if (langToExt[lang] != null) lang = langToExt[lang];
      return "proxies/caman_proxy." + lang;
    };

    IO.prototype.save = function(type) {
      var image;
      if (type == null) type = "png";
      type = type.toLowerCase();
      image = this.toBase64(type).replace("image/" + type, "image/octet-stream");
      return document.location.href = image;
    };

    IO.prototype.toImage = function(type) {
      var img;
      img = document.createElement('img');
      img.src = this.toBase64(type);
      return img;
    };

    IO.prototype.toBase64 = function(type) {
      if (type == null) type = "png";
      type = type.toLowerCase();
      return this.canvas.toDataURL("image/" + type);
    };

    return IO;

  })();

  Util.extend(CamanInstance.prototype, IO.prototype);

  Caman.IO = IO;

  Layer = (function() {

    function Layer(c) {
      this.c = c;
      this.filter = this.c;
      this.options = {
        blendingMode: 'normal',
        opacity: 1.0
      };
      this.layerID = Util.uniqid.get();
      this.canvas = document.createElement('canvas');
      this.canvas.width = this.c.dimensions.width;
      this.canvas.height = this.c.dimensions.height;
      this.context = this.canvas.getContext('2d');
      this.context.createImageData(this.canvas.width, this.canvas.height);
      this.imageData = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
      this.pixelData = this.imageData.data;
    }

    Layer.prototype.newLayer = function(cb) {
      return this.c.newLayer.call(this.c, cb);
    };

    Layer.prototype.setBlendingMode = function(mode) {
      this.options.blendingMode = mode;
      return this;
    };

    Layer.prototype.opacity = function(opacity) {
      this.options.opacity = opacity / 100;
      return this;
    };

    Layer.prototype.copyParent = function() {
      var i, parentData, _ref;
      parentData = this.c.pixelData;
      for (i = 0, _ref = this.c.pixelData.length; i < _ref; i += 4) {
        this.pixelData[i] = parentData[i];
        this.pixelData[i + 1] = parentData[i + 1];
        this.pixelData[i + 2] = parentData[i + 2];
        this.pixelData[i + 3] = parentData[i + 3];
      }
      return this;
    };

    Layer.prototype.fillColor = function() {
      return this.c.fillcolor.apply(this.c, arguments);
    };

    Layer.prototype.overlayImage = function(image) {
      if (typeof image === "object") {
        image = image.src;
      } else if (typeof image === "string" && image[0] === "#") {
        image = $(image).src;
      }
      if (!image) return this;
      this.c.renderQueue.push({
        type: Filter.Type.LoadOverlay,
        src: image,
        layer: this
      });
      return this;
    };

    Layer.prototype.applyToParent = function() {
      var i, layerData, parentData, result, rgbaLayer, rgbaParent, _ref, _results;
      parentData = this.c.pixelStack[this.c.pixelStack.length - 1];
      layerData = this.c.pixelData;
      _results = [];
      for (i = 0, _ref = layerData.length; i < _ref; i += 4) {
        rgbaParent = {
          r: parentData[i],
          g: parentData[i + 1],
          b: parentData[i + 2],
          a: parentData[i + 3]
        };
        rgbaLayer = {
          r: layerData[i],
          g: layerData[i + 1],
          b: layerData[i + 2],
          a: layerData[i + 3]
        };
        result = Blender.execute(this.options.blendingMode, rgbaLayer, rgbaParent);
        result.r = Util.clampRGB(result.r);
        result.g = Util.clampRGB(result.g);
        result.b = Util.clampRGB(result.b);
        if (!(result.a != null)) result.a = rgbaLayer.a;
        parentData[i] = rgbaParent.r - ((rgbaParent.r - result.r) * (this.options.opacity * (result.a / 255)));
        parentData[i + 1] = rgbaParent.g - ((rgbaParent.g - result.g) * (this.options.opacity * (result.a / 255)));
        _results.push(parentData[i + 2] = rgbaParent.b - ((rgbaParent.b - result.b) * (this.options.opacity * (result.a / 255))));
      }
      return _results;
    };

    return Layer;

  })();

  Logger = (function() {

    function Logger() {
      var name, _i, _len, _ref;
      _ref = ['log', 'info', 'warn', 'error'];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        name = _ref[_i];
        this[name] = (function(name) {
          return function() {
            if ((window.console != null) && Caman.DEBUG) {
              return window.console[name].apply(console, arguments);
            }
          };
        })(name);
      }
      this.debug = this.log;
    }

    return Logger;

  })();

  Log = new Logger();

  PixelInfo = (function() {

    function PixelInfo(c) {
      this.c = c;
      this.loc = 0;
    }

    PixelInfo.prototype.locationXY = function() {
      var x, y;
      y = this.c.dimensions.height - Math.floor(this.loc / (this.c.dimensions.width * 4));
      x = (this.loc % (this.c.dimensions.width * 4)) / 4;
      return {
        x: x,
        y: y
      };
    };

    PixelInfo.prototype.getPixelRelative = function(horiz, vert) {
      var newLoc;
      newLoc = this.loc + (this.c.dimensions.width * 4 * (vert * -1)) + (4 * horiz);
      if (newLoc > this.c.pixelData.length || newLoc < 0) {
        return {
          r: 0,
          g: 0,
          b: 0,
          a: 0
        };
      }
      return {
        r: this.c.pixelData[newLoc],
        g: this.c.pixelData[newLoc + 1],
        b: this.c.pixelData[newLoc + 2],
        a: this.c.pixelData[newLoc + 3]
      };
    };

    PixelInfo.prototype.putPixelRelative = function(horiz, vert, rgba) {
      var nowLoc;
      nowLoc = this.loc + (this.c.dimensions.width * 4 * (vert * -1)) + (4 * horiz);
      if (newLoc > this.c.pixelData.length || newLoc < 0) return;
      this.c.pixelData[newLoc] = rgba.r;
      this.c.pixelData[newLoc + 1] = rgba.g;
      this.c.pixelData[newLoc + 2] = rgba.b;
      this.c.pixelData[newLoc + 3] = rgba.a;
      return true;
    };

    PixelInfo.prototype.getPixel = function(x, y) {
      var loc;
      loc = (y * this.c.dimensions.width + x) * 4;
      return {
        r: this.c.pixelData[loc],
        g: this.c.pixelData[loc + 1],
        b: this.c.pixelData[loc + 2],
        a: this.c.pixelData[loc + 3]
      };
    };

    PixelInfo.prototype.putPixel = function(x, y, rgba) {
      var loc;
      loc = (y * this.c.dimensions.width + x) * 4;
      this.c.pixelData[loc] = rgba.r;
      this.c.pixelData[loc + 1] = rgba.g;
      this.c.pixelData[loc + 2] = rgba.b;
      return this.c.pixelData[loc + 3] = rgba.a;
    };

    return PixelInfo;

  })();

  Plugin = (function() {

    function Plugin() {}

    Plugin.plugins = {};

    Plugin.register = function(name, plugin) {
      return this.plugins[name] = plugin;
    };

    Plugin.execute = function(context, name, args) {
      return this.plugins[name].apply(context, args);
    };

    return Plugin;

  })();

  Caman.Plugin = Plugin;

  RenderJob = (function() {

    RenderJob.Blocks = 4;

    RenderJob.execute = function(instance, job, callback) {
      var layer, rj;
      rj = new RenderJob(instance, job, callback);
      switch (job.type) {
        case Filter.Type.LayerDequeue:
          layer = instance.canvasQueue.shift();
          instance.executeLayer(layer);
          break;
        case Filter.Type.LayerFinished:
          instance.applyCurrentLayer();
          instance.popContext();
          callback();
          break;
        case Filter.Type.LoadOverlay:
          rj.loadOverlay(job.layer, job.src);
          break;
        case Filter.Type.Plugin:
          rj.executePlugin();
          break;
        default:
          rj.executeFilter();
      }
      return instance;
    };

    function RenderJob(c, job, renderDone) {
      this.c = c;
      this.job = job;
      this.renderDone = renderDone;
    }

    RenderJob.prototype.executeFilter = function() {
      var blockN, blockPixelLength, end, j, lastBlockN, n, start, _ref, _results,
        _this = this;
      this.blocksDone = 0;
      n = this.c.pixelData.length;
      blockPixelLength = Math.floor((n / 4) / RenderJob.Blocks);
      blockN = blockPixelLength * 4;
      lastBlockN = blockN + ((n / 4) % RenderJob.Blocks) * 4;
      Event.trigger(this.c, "processStart", this.job);
      if (this.job.type === Filter.Type.Single) {
        _results = [];
        for (j = 0, _ref = RenderJob.Blocks; 0 <= _ref ? j < _ref : j > _ref; 0 <= _ref ? j++ : j--) {
          start = j * blockN;
          end = start + (j === RenderJob.Blocks - 1 ? lastBlockN : blockN);
          _results.push(setTimeout((function(j, start, end) {
            return function() {
              return _this.renderBlock(j, start, end);
            };
          })(j, start, end), 0));
        }
        return _results;
      } else {
        return this.renderKernel();
      }
    };

    RenderJob.prototype.executePlugin = function() {
      Log.debug("Executing plugin " + this.job.plugin);
      Plugin.execute(this.c, this.job.plugin, this.job.args);
      Log.debug("Plugin " + this.job.plugin + " finished!");
      return this.renderDone();
    };

    RenderJob.prototype.renderBlock = function(bnum, start, end) {
      var data, i, pixelInfo, res;
      Log.debug("BLOCK #" + bnum + " - Filter: " + this.job.name + ", Start: " + start + ", End: " + end);
      data = {
        r: 0,
        g: 0,
        b: 0,
        a: 0
      };
      pixelInfo = new PixelInfo(this.c);
      for (i = start; i < end; i += 4) {
        pixelInfo.loc = i;
        data.r = this.c.pixelData[i];
        data.g = this.c.pixelData[i + 1];
        data.b = this.c.pixelData[i + 2];
        res = this.job.processFn.call(pixelInfo, data);
        this.c.pixelData[i] = Util.clampRGB(res.r);
        this.c.pixelData[i + 1] = Util.clampRGB(res.g);
        this.c.pixelData[i + 2] = Util.clampRGB(res.b);
      }
      return this.blockFinished(bnum);
    };

    RenderJob.prototype.renderKernel = function() {
      var adjust, adjustSize, bias, builder, builderIndex, divisor, end, i, j, k, kernel, modPixelData, n, name, pixel, pixelInfo, res, start;
      name = this.job.name;
      bias = this.job.bias;
      divisor = this.job.divisor;
      n = this.c.pixelData.length;
      adjust = this.job.adjust;
      adjustSize = Math.sqrt(adjust.length);
      kernel = [];
      modPixelData = [];
      Log.debug("Rendering kernel - Filter: " + this.job.name);
      start = this.c.dimensions.width * 4 * ((adjustSize - 1) / 2);
      end = n - (this.c.dimensions.width * 4 * ((adjustSize - 1) / 2));
      builder = (adjustSize - 1) / 2;
      pixelInfo = new PixelInfo(this.c);
      for (i = start; i < end; i += 4) {
        pixelInfo.loc = i;
        builderIndex = 0;
        for (j = -builder; -builder <= builder ? j <= builder : j >= builder; -builder <= builder ? j++ : j--) {
          for (k = builder; builder <= -builder ? k <= -builder : k >= -builder; builder <= -builder ? k++ : k--) {
            pixel = pixelInfo.getPixelRelative(j, k);
            kernel[builderIndex * 3] = pixel.r;
            kernel[builderIndex * 3 + 1] = pixel.g;
            kernel[builderIndex * 3 + 2] = pixel.b;
            builderIndex++;
          }
        }
        res = this.processKernel(adjust, kernel, divisor, bias);
        modPixelData[i] = Util.clampRGB(res.r);
        modPixelData[i + 1] = Util.clampRGB(res.g);
        modPixelData[i + 2] = Util.clampRGB(res.b);
        modPixelData[i + 3] = this.c.pixelData[i + 3];
      }
      for (i = start; start <= end ? i < end : i > end; start <= end ? i++ : i--) {
        this.c.pixelData[i] = modPixelData[i];
      }
      return this.blockFinished(-1);
    };

    RenderJob.prototype.blockFinished = function(bnum) {
      if (bnum >= 0) {
        Log.debug("Block #" + bnum + " finished! Filter: " + this.job.name);
      }
      this.blocksDone++;
      if (this.blocksDone === RenderJob.Blocks || bnum === -1) {
        if (bnum >= 0) Log.debug("Filter " + this.job.name + " finished!");
        if (bnum < 0) Log.debug("Kernel filter " + this.job.name + " finished!");
        Event.trigger(this.c, "processComplete", this.job);
        return this.renderDone();
      }
    };

    RenderJob.prototype.processKernel = function(adjust, kernel, divisor, bias) {
      var i, val, _ref;
      val = {
        r: 0,
        g: 0,
        b: 0
      };
      for (i = 0, _ref = adjust.length; 0 <= _ref ? i < _ref : i > _ref; 0 <= _ref ? i++ : i--) {
        val.r += adjust[i] * kernel[i * 3];
        val.g += adjust[i] * kernel[i * 3 + 1];
        val.b += adjust[i] * kernel[i * 3 + 2];
      }
      val.r = (val.r / divisor) + bias;
      val.g = (val.g / divisor) + bias;
      val.b = (val.b / divisor) + bias;
      return val;
    };

    RenderJob.prototype.loadOverlay = function(layer, src) {
      var img, proxyUrl,
        _this = this;
      img = document.createElement('img');
      img.onload = function() {
        layer.context.drawImage(img, 0, 0, _this.c.dimensions.width, _this.c.dimensions.height);
        layer.imageData = layer.context.getImageData(0, 0, _this.c.dimensions.width, _this.c.dimensions.height);
        layer.pixelData = layer.imageData.data;
        _this.c.pixelData = layer.pixelData;
        return _this.c.processNext();
      };
      proxyUrl = IO.remoteCheck(src);
      return img.src = proxyUrl != null ? proxyUrl : src;
    };

    return RenderJob;

  })();

  Store = (function() {

    function Store() {}

    Store.items = {};

    Store.has = function(search) {
      return this.items[search] != null;
    };

    Store.get = function(search) {
      return this.items[search];
    };

    Store.put = function(name, obj) {
      return this.items[name] = obj;
    };

    Store.execute = function(search, callback) {
      return callback.call(this.get(search), this.get(search));
    };

    return Store;

  })();

  Blender.register("normal", function(rgbaLayer, rgbaParent) {
    return {
      r: rgbaLayer.r,
      g: rgbaLayer.g,
      b: rgbaLayer.b
    };
  });

  Blender.register("multiply", function(rgbaLayer, rgbaParent) {
    return {
      r: (rgbaLayer.r * rgbaParent.r) / 255,
      g: (rgbaLayer.g * rgbaParent.g) / 255,
      b: (rgbaLayer.b * rgbaParent.b) / 255
    };
  });

  Blender.register("screen", function(rgbaLayer, rgbaParent) {
    return {
      r: 255 - (((255 - rgbaLayer.r) * (255 - rgbaParent.r)) / 255),
      g: 255 - (((255 - rgbaLayer.g) * (255 - rgbaParent.g)) / 255),
      b: 255 - (((255 - rgbaLayer.b) * (255 - rgbaParent.b)) / 255)
    };
  });

  Blender.register("overlay", function(rgbaLayer, rgbaParent) {
    var result;
    result = {};
    result.r = rgbaParent.r > 128 ? 255 - 2 * (255 - rgbaLayer.r) * (255 - rgbaParent.r) / 255 : (rgbaParent.r * rgbaLayer.r * 2) / 255;
    result.g = rgbaParent.g > 128 ? 255 - 2 * (255 - rgbaLayer.g) * (255 - rgbaParent.g) / 255 : (rgbaParent.g * rgbaLayer.g * 2) / 255;
    result.b = rgbaParent.b > 128 ? 255 - 2 * (255 - rgbaLayer.b) * (255 - rgbaParent.b) / 255 : (rgbaParent.b * rgbaLayer.b * 2) / 255;
    return result;
  });

  Blender.register("difference", function(rgbaLayer, rgbaParent) {
    return {
      r: rgbaLayer.r - rgbaParent.r,
      g: rgbaLayer.g - rgbaParent.g,
      b: rgbaLayer.b - rgbaParent.b
    };
  });

  Blender.register("addition", function(rgbaLayer, rgbaParent) {
    return {
      r: rgbaParent.r + rgbaLayer.r,
      g: rgbaParent.g + rgbaLayer.g,
      b: rgbaParent.b + rgbaLayer.b
    };
  });

  Blender.register("exclusion", function(rgbaLayer, rgbaParent) {
    return {
      r: 128 - 2 * (rgbaParent.r - 128) * (rgbaLayer.r - 128) / 255,
      g: 128 - 2 * (rgbaParent.g - 128) * (rgbaLayer.g - 128) / 255,
      b: 128 - 2 * (rgbaParent.b - 128) * (rgbaLayer.b - 128) / 255
    };
  });

  Blender.register("softLight", function(rgbaLayer, rgbaParent) {
    var result;
    result = {};
    result.r = rgbaParent.r > 128 ? 255 - ((255 - rgbaParent.r) * (255 - (rgbaLayer.r - 128))) / 255 : (rgbaParent.r * (rgbaLayer.r + 128)) / 255;
    result.g = rgbaParent.g > 128 ? 255 - ((255 - rgbaParent.g) * (255 - (rgbaLayer.g - 128))) / 255 : (rgbaParent.g * (rgbaLayer.g + 128)) / 255;
    result.b = rgbaParent.b > 128 ? 255 - ((255 - rgbaParent.b) * (255 - (rgbaLayer.b - 128))) / 255 : (rgbaParent.b * (rgbaLayer.b + 128)) / 255;
    return result;
  });

  Filter.register("fillColor", function() {
    var color;
    if (arguments.length === 1) {
      color = Convert.hexToRGB(arguments[0]);
    } else {
      color = {
        r: arguments[0],
        g: arguments[1],
        b: arguments[2]
      };
    }
    return this.process("fillColor", function(rgba) {
      rgba.r = color.r;
      rgba.g = color.g;
      rgba.b = color.b;
      return rgba;
    });
  });

  Filter.register("brightness", function(adjust) {
    adjust = Math.floor(255 * (adjust / 100));
    return this.process("brightness", function(rgba) {
      rgba.r += adjust;
      rgba.g += adjust;
      rgba.b += adjust;
      return rgba;
    });
  });

  Filter.register("saturation", function(adjust) {
    adjust *= -0.01;
    return this.process("saturation", function(rgba) {
      var max;
      max = Math.max(rgba.r, rgba.g, rgba.b);
      if (rgba.r !== max) rgba.r += (max - rgba.r) * adjust;
      if (rgba.g !== max) rgba.g += (max - rgba.g) * adjust;
      if (rgba.b !== max) rgba.b += (max - rgba.b) * adjust;
      return rgba;
    });
  });

  Filter.register("vibrance", function(adjust) {
    adjust *= -1;
    return this.process("vibrance", function(rgba) {
      var amt, avg, max;
      max = Math.max(rgba.r, rgba.g, rgba.b);
      avg = (rgba.r + rgba.g + rgba.b) / 3;
      amt = ((Math.abs(max - avg) * 2 / 255) * adjust) / 100;
      if (rgba.r !== max) rgba.r += (max - rgba.r) * amt;
      if (rgba.g !== max) rgba.g += (max - rgba.g) * amt;
      if (rgba.b !== max) rgba.b += (max - rgba.b) * amt;
      return rgba;
    });
  });

  Filter.register("greyscale", function(adjust) {
    return this.process("greyscale", function(rgba) {
      var avg;
      avg = 0.3 * rgba.r + 0.59 * rgba.g + 0.11 * rgba.b;
      rgba.r = avg;
      rgba.g = avg;
      rgba.b = avg;
      return rgba;
    });
  });

  Filter.register("contrast", function(adjust) {
    adjust = Math.pow((adjust + 100) / 100, 2);
    return this.process("contrast", function(rgba) {
      rgba.r /= 255;
      rgba.r -= 0.5;
      rgba.r *= adjust;
      rgba.r += 0.5;
      rgba.r *= 255;
      rgba.g /= 255;
      rgba.g -= 0.5;
      rgba.g *= adjust;
      rgba.g += 0.5;
      rgba.g *= 255;
      rgba.b /= 255;
      rgba.b -= 0.5;
      rgba.b *= adjust;
      rgba.b += 0.5;
      rgba.b *= 255;
      return rgba;
    });
  });

  Filter.register("hue", function(adjust) {
    return this.process("hue", function(rgba) {
      var h, hsv, rgb;
      hsv = Convert.rgbToHSV(rgba.r, rgba.g, rgba.b);
      h = hsv.h * 100;
      h += Math.abs(adjust);
      h = h % 100;
      h /= 100;
      hsv.h = h;
      rgb = Convert.hsvToRGB(hsv.h, hsv.s, hsv.v);
      rgb.a = rgba.a;
      return rgb;
    });
  });

  Filter.register("colorize", function() {
    var level, rgb;
    if (arguments.length === 2) {
      rgb = Convert.hexToRGB(arguments[0]);
      level = arguments[1];
    } else if (arguments.length === 4) {
      rgb = {
        r: arguments[0],
        g: arguments[1],
        b: arguments[2]
      };
      level = arguments[3];
    }
    return this.process("colorize", function(rgba) {
      rgba.r -= (rgba.r - rgb.r) * (level / 100);
      rgba.g -= (rgba.g - rgb.g) * (level / 100);
      rgba.b -= (rgba.b - rgb.b) * (level / 100);
      return rgba;
    });
  });

  Filter.register("invert", function() {
    return this.process("invert", function(rgba) {
      rgba.r = 255 - rgba.r;
      rgba.g = 255 - rgba.g;
      rgba.b = 255 - rgba.b;
      return rgba;
    });
  });

  Filter.register("sepia", function(adjust) {
    if (adjust == null) adjust = 100;
    adjust /= 100;
    return this.process("sepia", function(rgba) {
      rgba.r = Math.min(255, (rgba.r * (1 - (0.607 * adjust))) + (rgba.g * (0.769 * adjust)) + (rgba.b * (0.189 * adjust)));
      rgba.g = Math.min(255, (rgba.r * (0.349 * adjust)) + (rgba.g * (1 - (0.314 * adjust))) + (rgba.b * (0.168 * adjust)));
      rgba.b = Math.min(255, (rgba.r * (0.272 * adjust)) + (rgba.g * (0.534 * adjust)) + (rgba.b * (1 - (0.869 * adjust))));
      return rgba;
    });
  });

  Filter.register("gamma", function(adjust) {
    return this.process("gamma", function(rgba) {
      rgba.r = Math.pow(rgba.r / 255, adjust) * 255;
      rgba.g = Math.pow(rgba.g / 255, adjust) * 255;
      rgba.b = Math.pow(rgba.b / 255, adjust) * 255;
      return rgba;
    });
  });

  Filter.register("noise", function(adjust) {
    adjust = Math.abs(adjust) * 2.55;
    return this.process("noise", function(rgba) {
      var rand;
      rand = Calculate.randomRange(adjust * -1, adjust);
      rgba.r += rand;
      rgba.g += rand;
      rgba.b += rand;
      return rgba;
    });
  });

  Filter.register("clip", function(adjust) {
    adjust = Math.abs(adjust) * 2.55;
    return this.process("clip", function(rgba) {
      if (rgba.r > 255 - adjust) {
        rgba.r = 255;
      } else if (rgba.r < adjust) {
        rgba.r = 0;
      }
      if (rgba.g > 255 - adjust) {
        rgba.g = 255;
      } else if (rgba.g < adjust) {
        rgba.g = 0;
      }
      if (rgba.b > 255 - adjust) {
        rgba.b = 255;
      } else if (rgba.b < adjust) {
        rgba.b = 0;
      }
      return rgba;
    });
  });

  Filter.register("channels", function(options) {
    var chan, value;
    if (typeof options !== "object") return this;
    for (chan in options) {
      if (!__hasProp.call(options, chan)) continue;
      value = options[chan];
      if (value === 0) {
        delete options[chan];
        continue;
      }
      options[chan] /= 100;
    }
    if (options.length === 0) return this;
    return this.process("channels", function(rgba) {
      if (options.red != null) {
        if (options.red > 0) {
          rgba.r += (255 - rgba.r) * options.red;
        } else {
          rgba.r -= rgba.r * Math.abs(options.red);
        }
      }
      if (options.green != null) {
        if (options.green > 0) {
          rgba.g += (255 - rgba.g) * options.green;
        } else {
          rgba.g -= rgba.g * Math.abs(options.green);
        }
      }
      if (options.blue != null) {
        if (options.blue > 0) {
          rgba.b += (255 - rgba.b) * options.blue;
        } else {
          rgba.b -= rgba.b * Math.abs(options.blue);
        }
      }
      return rgba;
    });
  });

  Filter.register("curves", function(chans, start, ctrl1, ctrl2, end) {
    var bezier, i, _ref, _ref2;
    if (typeof chans === "string") chans = chans.split("");
    bezier = Calculate.bezier(start, ctrl1, ctrl2, end, 0, 255);
    if (start[0] > 0) {
      for (i = 0, _ref = start[0]; 0 <= _ref ? i < _ref : i > _ref; 0 <= _ref ? i++ : i--) {
        bezier[i] = start[1];
      }
    }
    if (end[0] < 255) {
      for (i = _ref2 = end[0]; _ref2 <= 255 ? i <= 255 : i >= 255; _ref2 <= 255 ? i++ : i--) {
        bezier[i] = end[1];
      }
    }
    return this.process("curves", function(rgba) {
      var i, _ref3;
      for (i = 0, _ref3 = chans.length; 0 <= _ref3 ? i < _ref3 : i > _ref3; 0 <= _ref3 ? i++ : i--) {
        rgba[chans[i]] = bezier[rgba[chans[i]]];
      }
      return rgba;
    });
  });

  Filter.register("exposure", function(adjust) {
    var ctrl1, ctrl2, p;
    p = Math.abs(adjust) / 100;
    ctrl1 = [0, 255 * p];
    ctrl2 = [255 - (255 * p), 255];
    if (adjust < 0) {
      ctrl1 = ctrl1.reverse();
      ctrl2 = ctrl2.reverse();
    }
    return this.curves('rgb', [0, 0], ctrl1, ctrl2, [255, 255]);
  });

}).call(this);
