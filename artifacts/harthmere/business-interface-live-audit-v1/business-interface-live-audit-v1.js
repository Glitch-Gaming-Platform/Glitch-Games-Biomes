"use strict";
(()=>{
    var __create = Object.create;
    var __defProp = Object.defineProperty;
    var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
    var __getOwnPropNames = Object.getOwnPropertyNames;
    var __getProtoOf = Object.getPrototypeOf;
    var __hasOwnProp = Object.prototype.hasOwnProperty;
    var __commonJS = (cb, mod)=>function __require() {
            return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = {
                exports: {}
            }).exports, mod), mod.exports;
        };
    var __copyProps = (to, from, except, desc)=>{
        if (from && typeof from === "object" || typeof from === "function") {
            for (let key of __getOwnPropNames(from))if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
                get: ()=>from[key],
                enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
            });
        }
        return to;
    };
    var __toESM = (mod, isNodeMode, target)=>(target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
            value: mod,
            enumerable: true
        }) : target, mod));
    // node_modules/react/cjs/react.production.min.js
    var require_react_production_min = __commonJS({
        "node_modules/react/cjs/react.production.min.js" (exports) {
            "use strict";
            var l = Symbol.for("react.element");
            var n = Symbol.for("react.portal");
            var p = Symbol.for("react.fragment");
            var q = Symbol.for("react.strict_mode");
            var r = Symbol.for("react.profiler");
            var t = Symbol.for("react.provider");
            var u = Symbol.for("react.context");
            var v = Symbol.for("react.forward_ref");
            var w = Symbol.for("react.suspense");
            var x = Symbol.for("react.memo");
            var y = Symbol.for("react.lazy");
            var z = Symbol.iterator;
            function A(a) {
                if (null === a || "object" !== typeof a) return null;
                a = z && a[z] || a["@@iterator"];
                return "function" === typeof a ? a : null;
            }
            var B = {
                isMounted: function() {
                    return false;
                },
                enqueueForceUpdate: function() {},
                enqueueReplaceState: function() {},
                enqueueSetState: function() {}
            };
            var C = Object.assign;
            var D = {};
            function E(a, b, e) {
                this.props = a;
                this.context = b;
                this.refs = D;
                this.updater = e || B;
            }
            E.prototype.isReactComponent = {};
            E.prototype.setState = function(a, b) {
                if ("object" !== typeof a && "function" !== typeof a && null != a) throw Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");
                this.updater.enqueueSetState(this, a, b, "setState");
            };
            E.prototype.forceUpdate = function(a) {
                this.updater.enqueueForceUpdate(this, a, "forceUpdate");
            };
            function F() {}
            F.prototype = E.prototype;
            function G(a, b, e) {
                this.props = a;
                this.context = b;
                this.refs = D;
                this.updater = e || B;
            }
            var H = G.prototype = new F();
            H.constructor = G;
            C(H, E.prototype);
            H.isPureReactComponent = true;
            var I = Array.isArray;
            var J = Object.prototype.hasOwnProperty;
            var K = {
                current: null
            };
            var L = {
                key: true,
                ref: true,
                __self: true,
                __source: true
            };
            function M(a, b, e) {
                var d, c = {}, k = null, h = null;
                if (null != b) for(d in void 0 !== b.ref && (h = b.ref), void 0 !== b.key && (k = "" + b.key), b)J.call(b, d) && !L.hasOwnProperty(d) && (c[d] = b[d]);
                var g = arguments.length - 2;
                if (1 === g) c.children = e;
                else if (1 < g) {
                    for(var f = Array(g), m = 0; m < g; m++)f[m] = arguments[m + 2];
                    c.children = f;
                }
                if (a && a.defaultProps) for(d in g = a.defaultProps, g)void 0 === c[d] && (c[d] = g[d]);
                return {
                    $$typeof: l,
                    type: a,
                    key: k,
                    ref: h,
                    props: c,
                    _owner: K.current
                };
            }
            function N(a, b) {
                return {
                    $$typeof: l,
                    type: a.type,
                    key: b,
                    ref: a.ref,
                    props: a.props,
                    _owner: a._owner
                };
            }
            function O(a) {
                return "object" === typeof a && null !== a && a.$$typeof === l;
            }
            function escape(a) {
                var b = {
                    "=": "=0",
                    ":": "=2"
                };
                return "$" + a.replace(/[=:]/g, function(a2) {
                    return b[a2];
                });
            }
            var P = /\/+/g;
            function Q(a, b) {
                return "object" === typeof a && null !== a && null != a.key ? escape("" + a.key) : b.toString(36);
            }
            function R(a, b, e, d, c) {
                var k = typeof a;
                if ("undefined" === k || "boolean" === k) a = null;
                var h = false;
                if (null === a) h = true;
                else switch(k){
                    case "string":
                    case "number":
                        h = true;
                        break;
                    case "object":
                        switch(a.$$typeof){
                            case l:
                            case n:
                                h = true;
                        }
                }
                if (h) return h = a, c = c(h), a = "" === d ? "." + Q(h, 0) : d, I(c) ? (e = "", null != a && (e = a.replace(P, "$&/") + "/"), R(c, b, e, "", function(a2) {
                    return a2;
                })) : null != c && (O(c) && (c = N(c, e + (!c.key || h && h.key === c.key ? "" : ("" + c.key).replace(P, "$&/") + "/") + a)), b.push(c)), 1;
                h = 0;
                d = "" === d ? "." : d + ":";
                if (I(a)) for(var g = 0; g < a.length; g++){
                    k = a[g];
                    var f = d + Q(k, g);
                    h += R(k, b, e, f, c);
                }
                else if (f = A(a), "function" === typeof f) for(a = f.call(a), g = 0; !(k = a.next()).done;)k = k.value, f = d + Q(k, g++), h += R(k, b, e, f, c);
                else if ("object" === k) throw b = String(a), Error("Objects are not valid as a React child (found: " + ("[object Object]" === b ? "object with keys {" + Object.keys(a).join(", ") + "}" : b) + "). If you meant to render a collection of children, use an array instead.");
                return h;
            }
            function S(a, b, e) {
                if (null == a) return a;
                var d = [], c = 0;
                R(a, d, "", "", function(a2) {
                    return b.call(e, a2, c++);
                });
                return d;
            }
            function T(a) {
                if (-1 === a._status) {
                    var b = a._result;
                    b = b();
                    b.then(function(b2) {
                        if (0 === a._status || -1 === a._status) a._status = 1, a._result = b2;
                    }, function(b2) {
                        if (0 === a._status || -1 === a._status) a._status = 2, a._result = b2;
                    });
                    -1 === a._status && (a._status = 0, a._result = b);
                }
                if (1 === a._status) return a._result.default;
                throw a._result;
            }
            var U = {
                current: null
            };
            var V = {
                transition: null
            };
            var W = {
                ReactCurrentDispatcher: U,
                ReactCurrentBatchConfig: V,
                ReactCurrentOwner: K
            };
            exports.Children = {
                map: S,
                forEach: function(a, b, e) {
                    S(a, function() {
                        b.apply(this, arguments);
                    }, e);
                },
                count: function(a) {
                    var b = 0;
                    S(a, function() {
                        b++;
                    });
                    return b;
                },
                toArray: function(a) {
                    return S(a, function(a2) {
                        return a2;
                    }) || [];
                },
                only: function(a) {
                    if (!O(a)) throw Error("React.Children.only expected to receive a single React element child.");
                    return a;
                }
            };
            exports.Component = E;
            exports.Fragment = p;
            exports.Profiler = r;
            exports.PureComponent = G;
            exports.StrictMode = q;
            exports.Suspense = w;
            exports.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = W;
            exports.cloneElement = function(a, b, e) {
                if (null === a || void 0 === a) throw Error("React.cloneElement(...): The argument must be a React element, but you passed " + a + ".");
                var d = C({}, a.props), c = a.key, k = a.ref, h = a._owner;
                if (null != b) {
                    void 0 !== b.ref && (k = b.ref, h = K.current);
                    void 0 !== b.key && (c = "" + b.key);
                    if (a.type && a.type.defaultProps) var g = a.type.defaultProps;
                    for(f in b)J.call(b, f) && !L.hasOwnProperty(f) && (d[f] = void 0 === b[f] && void 0 !== g ? g[f] : b[f]);
                }
                var f = arguments.length - 2;
                if (1 === f) d.children = e;
                else if (1 < f) {
                    g = Array(f);
                    for(var m = 0; m < f; m++)g[m] = arguments[m + 2];
                    d.children = g;
                }
                return {
                    $$typeof: l,
                    type: a.type,
                    key: c,
                    ref: k,
                    props: d,
                    _owner: h
                };
            };
            exports.createContext = function(a) {
                a = {
                    $$typeof: u,
                    _currentValue: a,
                    _currentValue2: a,
                    _threadCount: 0,
                    Provider: null,
                    Consumer: null,
                    _defaultValue: null,
                    _globalName: null
                };
                a.Provider = {
                    $$typeof: t,
                    _context: a
                };
                return a.Consumer = a;
            };
            exports.createElement = M;
            exports.createFactory = function(a) {
                var b = M.bind(null, a);
                b.type = a;
                return b;
            };
            exports.createRef = function() {
                return {
                    current: null
                };
            };
            exports.forwardRef = function(a) {
                return {
                    $$typeof: v,
                    render: a
                };
            };
            exports.isValidElement = O;
            exports.lazy = function(a) {
                return {
                    $$typeof: y,
                    _payload: {
                        _status: -1,
                        _result: a
                    },
                    _init: T
                };
            };
            exports.memo = function(a, b) {
                return {
                    $$typeof: x,
                    type: a,
                    compare: void 0 === b ? null : b
                };
            };
            exports.startTransition = function(a) {
                var b = V.transition;
                V.transition = {};
                try {
                    a();
                } finally{
                    V.transition = b;
                }
            };
            exports.unstable_act = function() {
                throw Error("act(...) is not supported in production builds of React.");
            };
            exports.useCallback = function(a, b) {
                return U.current.useCallback(a, b);
            };
            exports.useContext = function(a) {
                return U.current.useContext(a);
            };
            exports.useDebugValue = function() {};
            exports.useDeferredValue = function(a) {
                return U.current.useDeferredValue(a);
            };
            exports.useEffect = function(a, b) {
                return U.current.useEffect(a, b);
            };
            exports.useId = function() {
                return U.current.useId();
            };
            exports.useImperativeHandle = function(a, b, e) {
                return U.current.useImperativeHandle(a, b, e);
            };
            exports.useInsertionEffect = function(a, b) {
                return U.current.useInsertionEffect(a, b);
            };
            exports.useLayoutEffect = function(a, b) {
                return U.current.useLayoutEffect(a, b);
            };
            exports.useMemo = function(a, b) {
                return U.current.useMemo(a, b);
            };
            exports.useReducer = function(a, b, e) {
                return U.current.useReducer(a, b, e);
            };
            exports.useRef = function(a) {
                return U.current.useRef(a);
            };
            exports.useState = function(a) {
                return U.current.useState(a);
            };
            exports.useSyncExternalStore = function(a, b, e) {
                return U.current.useSyncExternalStore(a, b, e);
            };
            exports.useTransition = function() {
                return U.current.useTransition();
            };
            exports.version = "18.2.0";
        }
    });
    // node_modules/react/index.js
    var require_react = __commonJS({
        "node_modules/react/index.js" (exports, module) {
            "use strict";
            if (true) {
                module.exports = require_react_production_min();
            } else {
                module.exports = null;
            }
        }
    });
    // node_modules/scheduler/cjs/scheduler.production.min.js
    var require_scheduler_production_min = __commonJS({
        "node_modules/scheduler/cjs/scheduler.production.min.js" (exports) {
            "use strict";
            function f(a, b) {
                var c = a.length;
                a.push(b);
                a: for(; 0 < c;){
                    var d = c - 1 >>> 1, e = a[d];
                    if (0 < g(e, b)) a[d] = b, a[c] = e, c = d;
                    else break a;
                }
            }
            function h(a) {
                return 0 === a.length ? null : a[0];
            }
            function k(a) {
                if (0 === a.length) return null;
                var b = a[0], c = a.pop();
                if (c !== b) {
                    a[0] = c;
                    a: for(var d = 0, e = a.length, w = e >>> 1; d < w;){
                        var m = 2 * (d + 1) - 1, C = a[m], n = m + 1, x = a[n];
                        if (0 > g(C, c)) n < e && 0 > g(x, C) ? (a[d] = x, a[n] = c, d = n) : (a[d] = C, a[m] = c, d = m);
                        else if (n < e && 0 > g(x, c)) a[d] = x, a[n] = c, d = n;
                        else break a;
                    }
                }
                return b;
            }
            function g(a, b) {
                var c = a.sortIndex - b.sortIndex;
                return 0 !== c ? c : a.id - b.id;
            }
            if ("object" === typeof performance && "function" === typeof performance.now) {
                l = performance;
                exports.unstable_now = function() {
                    return l.now();
                };
            } else {
                p = Date, q = p.now();
                exports.unstable_now = function() {
                    return p.now() - q;
                };
            }
            var l;
            var p;
            var q;
            var r = [];
            var t = [];
            var u = 1;
            var v = null;
            var y = 3;
            var z = false;
            var A = false;
            var B = false;
            var D = "function" === typeof setTimeout ? setTimeout : null;
            var E = "function" === typeof clearTimeout ? clearTimeout : null;
            var F = "undefined" !== typeof setImmediate ? setImmediate : null;
            "undefined" !== typeof navigator && void 0 !== navigator.scheduling && void 0 !== navigator.scheduling.isInputPending && navigator.scheduling.isInputPending.bind(navigator.scheduling);
            function G(a) {
                for(var b = h(t); null !== b;){
                    if (null === b.callback) k(t);
                    else if (b.startTime <= a) k(t), b.sortIndex = b.expirationTime, f(r, b);
                    else break;
                    b = h(t);
                }
            }
            function H(a) {
                B = false;
                G(a);
                if (!A) if (null !== h(r)) A = true, I(J);
                else {
                    var b = h(t);
                    null !== b && K(H, b.startTime - a);
                }
            }
            function J(a, b) {
                A = false;
                B && (B = false, E(L), L = -1);
                z = true;
                var c = y;
                try {
                    G(b);
                    for(v = h(r); null !== v && (!(v.expirationTime > b) || a && !M());){
                        var d = v.callback;
                        if ("function" === typeof d) {
                            v.callback = null;
                            y = v.priorityLevel;
                            var e = d(v.expirationTime <= b);
                            b = exports.unstable_now();
                            "function" === typeof e ? v.callback = e : v === h(r) && k(r);
                            G(b);
                        } else k(r);
                        v = h(r);
                    }
                    if (null !== v) var w = true;
                    else {
                        var m = h(t);
                        null !== m && K(H, m.startTime - b);
                        w = false;
                    }
                    return w;
                } finally{
                    v = null, y = c, z = false;
                }
            }
            var N = false;
            var O = null;
            var L = -1;
            var P = 5;
            var Q = -1;
            function M() {
                return exports.unstable_now() - Q < P ? false : true;
            }
            function R() {
                if (null !== O) {
                    var a = exports.unstable_now();
                    Q = a;
                    var b = true;
                    try {
                        b = O(true, a);
                    } finally{
                        b ? S() : (N = false, O = null);
                    }
                } else N = false;
            }
            var S;
            if ("function" === typeof F) S = function() {
                F(R);
            };
            else if ("undefined" !== typeof MessageChannel) {
                T = new MessageChannel(), U = T.port2;
                T.port1.onmessage = R;
                S = function() {
                    U.postMessage(null);
                };
            } else S = function() {
                D(R, 0);
            };
            var T;
            var U;
            function I(a) {
                O = a;
                N || (N = true, S());
            }
            function K(a, b) {
                L = D(function() {
                    a(exports.unstable_now());
                }, b);
            }
            exports.unstable_IdlePriority = 5;
            exports.unstable_ImmediatePriority = 1;
            exports.unstable_LowPriority = 4;
            exports.unstable_NormalPriority = 3;
            exports.unstable_Profiling = null;
            exports.unstable_UserBlockingPriority = 2;
            exports.unstable_cancelCallback = function(a) {
                a.callback = null;
            };
            exports.unstable_continueExecution = function() {
                A || z || (A = true, I(J));
            };
            exports.unstable_forceFrameRate = function(a) {
                0 > a || 125 < a ? console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported") : P = 0 < a ? Math.floor(1e3 / a) : 5;
            };
            exports.unstable_getCurrentPriorityLevel = function() {
                return y;
            };
            exports.unstable_getFirstCallbackNode = function() {
                return h(r);
            };
            exports.unstable_next = function(a) {
                switch(y){
                    case 1:
                    case 2:
                    case 3:
                        var b = 3;
                        break;
                    default:
                        b = y;
                }
                var c = y;
                y = b;
                try {
                    return a();
                } finally{
                    y = c;
                }
            };
            exports.unstable_pauseExecution = function() {};
            exports.unstable_requestPaint = function() {};
            exports.unstable_runWithPriority = function(a, b) {
                switch(a){
                    case 1:
                    case 2:
                    case 3:
                    case 4:
                    case 5:
                        break;
                    default:
                        a = 3;
                }
                var c = y;
                y = a;
                try {
                    return b();
                } finally{
                    y = c;
                }
            };
            exports.unstable_scheduleCallback = function(a, b, c) {
                var d = exports.unstable_now();
                "object" === typeof c && null !== c ? (c = c.delay, c = "number" === typeof c && 0 < c ? d + c : d) : c = d;
                switch(a){
                    case 1:
                        var e = -1;
                        break;
                    case 2:
                        e = 250;
                        break;
                    case 5:
                        e = 1073741823;
                        break;
                    case 4:
                        e = 1e4;
                        break;
                    default:
                        e = 5e3;
                }
                e = c + e;
                a = {
                    id: u++,
                    callback: b,
                    priorityLevel: a,
                    startTime: c,
                    expirationTime: e,
                    sortIndex: -1
                };
                c > d ? (a.sortIndex = c, f(t, a), null === h(r) && a === h(t) && (B ? (E(L), L = -1) : B = true, K(H, c - d))) : (a.sortIndex = e, f(r, a), A || z || (A = true, I(J)));
                return a;
            };
            exports.unstable_shouldYield = M;
            exports.unstable_wrapCallback = function(a) {
                var b = y;
                return function() {
                    var c = y;
                    y = b;
                    try {
                        return a.apply(this, arguments);
                    } finally{
                        y = c;
                    }
                };
            };
        }
    });
    // node_modules/scheduler/index.js
    var require_scheduler = __commonJS({
        "node_modules/scheduler/index.js" (exports, module) {
            "use strict";
            if (true) {
                module.exports = require_scheduler_production_min();
            } else {
                module.exports = null;
            }
        }
    });
    // node_modules/react-dom/cjs/react-dom.production.min.js
    var require_react_dom_production_min = __commonJS({
        "node_modules/react-dom/cjs/react-dom.production.min.js" (exports) {
            "use strict";
            var aa = require_react();
            var ca = require_scheduler();
            function p(a) {
                for(var b = "https://reactjs.org/docs/error-decoder.html?invariant=" + a, c = 1; c < arguments.length; c++)b += "&args[]=" + encodeURIComponent(arguments[c]);
                return "Minified React error #" + a + "; visit " + b + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
            }
            var da = /* @__PURE__ */ new Set();
            var ea = {};
            function fa(a, b) {
                ha(a, b);
                ha(a + "Capture", b);
            }
            function ha(a, b) {
                ea[a] = b;
                for(a = 0; a < b.length; a++)da.add(b[a]);
            }
            var ia = !("undefined" === typeof window || "undefined" === typeof window.document || "undefined" === typeof window.document.createElement);
            var ja = Object.prototype.hasOwnProperty;
            var ka = /^[:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD][:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\-.0-9\u00B7\u0300-\u036F\u203F-\u2040]*$/;
            var la = {};
            var ma = {};
            function oa(a) {
                if (ja.call(ma, a)) return true;
                if (ja.call(la, a)) return false;
                if (ka.test(a)) return ma[a] = true;
                la[a] = true;
                return false;
            }
            function pa(a, b, c, d) {
                if (null !== c && 0 === c.type) return false;
                switch(typeof b){
                    case "function":
                    case "symbol":
                        return true;
                    case "boolean":
                        if (d) return false;
                        if (null !== c) return !c.acceptsBooleans;
                        a = a.toLowerCase().slice(0, 5);
                        return "data-" !== a && "aria-" !== a;
                    default:
                        return false;
                }
            }
            function qa(a, b, c, d) {
                if (null === b || "undefined" === typeof b || pa(a, b, c, d)) return true;
                if (d) return false;
                if (null !== c) switch(c.type){
                    case 3:
                        return !b;
                    case 4:
                        return false === b;
                    case 5:
                        return isNaN(b);
                    case 6:
                        return isNaN(b) || 1 > b;
                }
                return false;
            }
            function v(a, b, c, d, e, f, g) {
                this.acceptsBooleans = 2 === b || 3 === b || 4 === b;
                this.attributeName = d;
                this.attributeNamespace = e;
                this.mustUseProperty = c;
                this.propertyName = a;
                this.type = b;
                this.sanitizeURL = f;
                this.removeEmptyString = g;
            }
            var z = {};
            "children dangerouslySetInnerHTML defaultValue defaultChecked innerHTML suppressContentEditableWarning suppressHydrationWarning style".split(" ").forEach(function(a) {
                z[a] = new v(a, 0, false, a, null, false, false);
            });
            [
                [
                    "acceptCharset",
                    "accept-charset"
                ],
                [
                    "className",
                    "class"
                ],
                [
                    "htmlFor",
                    "for"
                ],
                [
                    "httpEquiv",
                    "http-equiv"
                ]
            ].forEach(function(a) {
                var b = a[0];
                z[b] = new v(b, 1, false, a[1], null, false, false);
            });
            [
                "contentEditable",
                "draggable",
                "spellCheck",
                "value"
            ].forEach(function(a) {
                z[a] = new v(a, 2, false, a.toLowerCase(), null, false, false);
            });
            [
                "autoReverse",
                "externalResourcesRequired",
                "focusable",
                "preserveAlpha"
            ].forEach(function(a) {
                z[a] = new v(a, 2, false, a, null, false, false);
            });
            "allowFullScreen async autoFocus autoPlay controls default defer disabled disablePictureInPicture disableRemotePlayback formNoValidate hidden loop noModule noValidate open playsInline readOnly required reversed scoped seamless itemScope".split(" ").forEach(function(a) {
                z[a] = new v(a, 3, false, a.toLowerCase(), null, false, false);
            });
            [
                "checked",
                "multiple",
                "muted",
                "selected"
            ].forEach(function(a) {
                z[a] = new v(a, 3, true, a, null, false, false);
            });
            [
                "capture",
                "download"
            ].forEach(function(a) {
                z[a] = new v(a, 4, false, a, null, false, false);
            });
            [
                "cols",
                "rows",
                "size",
                "span"
            ].forEach(function(a) {
                z[a] = new v(a, 6, false, a, null, false, false);
            });
            [
                "rowSpan",
                "start"
            ].forEach(function(a) {
                z[a] = new v(a, 5, false, a.toLowerCase(), null, false, false);
            });
            var ra = /[\-:]([a-z])/g;
            function sa(a) {
                return a[1].toUpperCase();
            }
            "accent-height alignment-baseline arabic-form baseline-shift cap-height clip-path clip-rule color-interpolation color-interpolation-filters color-profile color-rendering dominant-baseline enable-background fill-opacity fill-rule flood-color flood-opacity font-family font-size font-size-adjust font-stretch font-style font-variant font-weight glyph-name glyph-orientation-horizontal glyph-orientation-vertical horiz-adv-x horiz-origin-x image-rendering letter-spacing lighting-color marker-end marker-mid marker-start overline-position overline-thickness paint-order panose-1 pointer-events rendering-intent shape-rendering stop-color stop-opacity strikethrough-position strikethrough-thickness stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity stroke-width text-anchor text-decoration text-rendering underline-position underline-thickness unicode-bidi unicode-range units-per-em v-alphabetic v-hanging v-ideographic v-mathematical vector-effect vert-adv-y vert-origin-x vert-origin-y word-spacing writing-mode xmlns:xlink x-height".split(" ").forEach(function(a) {
                var b = a.replace(ra, sa);
                z[b] = new v(b, 1, false, a, null, false, false);
            });
            "xlink:actuate xlink:arcrole xlink:role xlink:show xlink:title xlink:type".split(" ").forEach(function(a) {
                var b = a.replace(ra, sa);
                z[b] = new v(b, 1, false, a, "http://www.w3.org/1999/xlink", false, false);
            });
            [
                "xml:base",
                "xml:lang",
                "xml:space"
            ].forEach(function(a) {
                var b = a.replace(ra, sa);
                z[b] = new v(b, 1, false, a, "http://www.w3.org/XML/1998/namespace", false, false);
            });
            [
                "tabIndex",
                "crossOrigin"
            ].forEach(function(a) {
                z[a] = new v(a, 1, false, a.toLowerCase(), null, false, false);
            });
            z.xlinkHref = new v("xlinkHref", 1, false, "xlink:href", "http://www.w3.org/1999/xlink", true, false);
            [
                "src",
                "href",
                "action",
                "formAction"
            ].forEach(function(a) {
                z[a] = new v(a, 1, false, a.toLowerCase(), null, true, true);
            });
            function ta(a, b, c, d) {
                var e = z.hasOwnProperty(b) ? z[b] : null;
                if (null !== e ? 0 !== e.type : d || !(2 < b.length) || "o" !== b[0] && "O" !== b[0] || "n" !== b[1] && "N" !== b[1]) qa(b, c, e, d) && (c = null), d || null === e ? oa(b) && (null === c ? a.removeAttribute(b) : a.setAttribute(b, "" + c)) : e.mustUseProperty ? a[e.propertyName] = null === c ? 3 === e.type ? false : "" : c : (b = e.attributeName, d = e.attributeNamespace, null === c ? a.removeAttribute(b) : (e = e.type, c = 3 === e || 4 === e && true === c ? "" : "" + c, d ? a.setAttributeNS(d, b, c) : a.setAttribute(b, c)));
            }
            var ua = aa.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
            var va = Symbol.for("react.element");
            var wa = Symbol.for("react.portal");
            var ya = Symbol.for("react.fragment");
            var za = Symbol.for("react.strict_mode");
            var Aa = Symbol.for("react.profiler");
            var Ba = Symbol.for("react.provider");
            var Ca = Symbol.for("react.context");
            var Da = Symbol.for("react.forward_ref");
            var Ea = Symbol.for("react.suspense");
            var Fa = Symbol.for("react.suspense_list");
            var Ga = Symbol.for("react.memo");
            var Ha = Symbol.for("react.lazy");
            Symbol.for("react.scope");
            Symbol.for("react.debug_trace_mode");
            var Ia = Symbol.for("react.offscreen");
            Symbol.for("react.legacy_hidden");
            Symbol.for("react.cache");
            Symbol.for("react.tracing_marker");
            var Ja = Symbol.iterator;
            function Ka(a) {
                if (null === a || "object" !== typeof a) return null;
                a = Ja && a[Ja] || a["@@iterator"];
                return "function" === typeof a ? a : null;
            }
            var A = Object.assign;
            var La;
            function Ma(a) {
                if (void 0 === La) try {
                    throw Error();
                } catch (c) {
                    var b = c.stack.trim().match(/\n( *(at )?)/);
                    La = b && b[1] || "";
                }
                return "\n" + La + a;
            }
            var Na = false;
            function Oa(a, b) {
                if (!a || Na) return "";
                Na = true;
                var c = Error.prepareStackTrace;
                Error.prepareStackTrace = void 0;
                try {
                    if (b) if (b = function() {
                        throw Error();
                    }, Object.defineProperty(b.prototype, "props", {
                        set: function() {
                            throw Error();
                        }
                    }), "object" === typeof Reflect && Reflect.construct) {
                        try {
                            Reflect.construct(b, []);
                        } catch (l) {
                            var d = l;
                        }
                        Reflect.construct(a, [], b);
                    } else {
                        try {
                            b.call();
                        } catch (l) {
                            d = l;
                        }
                        a.call(b.prototype);
                    }
                    else {
                        try {
                            throw Error();
                        } catch (l) {
                            d = l;
                        }
                        a();
                    }
                } catch (l) {
                    if (l && d && "string" === typeof l.stack) {
                        for(var e = l.stack.split("\n"), f = d.stack.split("\n"), g = e.length - 1, h = f.length - 1; 1 <= g && 0 <= h && e[g] !== f[h];)h--;
                        for(; 1 <= g && 0 <= h; g--, h--)if (e[g] !== f[h]) {
                            if (1 !== g || 1 !== h) {
                                do if (g--, h--, 0 > h || e[g] !== f[h]) {
                                    var k = "\n" + e[g].replace(" at new ", " at ");
                                    a.displayName && k.includes("<anonymous>") && (k = k.replace("<anonymous>", a.displayName));
                                    return k;
                                }
                                while (1 <= g && 0 <= h)
                            }
                            break;
                        }
                    }
                } finally{
                    Na = false, Error.prepareStackTrace = c;
                }
                return (a = a ? a.displayName || a.name : "") ? Ma(a) : "";
            }
            function Pa(a) {
                switch(a.tag){
                    case 5:
                        return Ma(a.type);
                    case 16:
                        return Ma("Lazy");
                    case 13:
                        return Ma("Suspense");
                    case 19:
                        return Ma("SuspenseList");
                    case 0:
                    case 2:
                    case 15:
                        return a = Oa(a.type, false), a;
                    case 11:
                        return a = Oa(a.type.render, false), a;
                    case 1:
                        return a = Oa(a.type, true), a;
                    default:
                        return "";
                }
            }
            function Qa(a) {
                if (null == a) return null;
                if ("function" === typeof a) return a.displayName || a.name || null;
                if ("string" === typeof a) return a;
                switch(a){
                    case ya:
                        return "Fragment";
                    case wa:
                        return "Portal";
                    case Aa:
                        return "Profiler";
                    case za:
                        return "StrictMode";
                    case Ea:
                        return "Suspense";
                    case Fa:
                        return "SuspenseList";
                }
                if ("object" === typeof a) switch(a.$$typeof){
                    case Ca:
                        return (a.displayName || "Context") + ".Consumer";
                    case Ba:
                        return (a._context.displayName || "Context") + ".Provider";
                    case Da:
                        var b = a.render;
                        a = a.displayName;
                        a || (a = b.displayName || b.name || "", a = "" !== a ? "ForwardRef(" + a + ")" : "ForwardRef");
                        return a;
                    case Ga:
                        return b = a.displayName || null, null !== b ? b : Qa(a.type) || "Memo";
                    case Ha:
                        b = a._payload;
                        a = a._init;
                        try {
                            return Qa(a(b));
                        } catch (c) {}
                }
                return null;
            }
            function Ra(a) {
                var b = a.type;
                switch(a.tag){
                    case 24:
                        return "Cache";
                    case 9:
                        return (b.displayName || "Context") + ".Consumer";
                    case 10:
                        return (b._context.displayName || "Context") + ".Provider";
                    case 18:
                        return "DehydratedFragment";
                    case 11:
                        return a = b.render, a = a.displayName || a.name || "", b.displayName || ("" !== a ? "ForwardRef(" + a + ")" : "ForwardRef");
                    case 7:
                        return "Fragment";
                    case 5:
                        return b;
                    case 4:
                        return "Portal";
                    case 3:
                        return "Root";
                    case 6:
                        return "Text";
                    case 16:
                        return Qa(b);
                    case 8:
                        return b === za ? "StrictMode" : "Mode";
                    case 22:
                        return "Offscreen";
                    case 12:
                        return "Profiler";
                    case 21:
                        return "Scope";
                    case 13:
                        return "Suspense";
                    case 19:
                        return "SuspenseList";
                    case 25:
                        return "TracingMarker";
                    case 1:
                    case 0:
                    case 17:
                    case 2:
                    case 14:
                    case 15:
                        if ("function" === typeof b) return b.displayName || b.name || null;
                        if ("string" === typeof b) return b;
                }
                return null;
            }
            function Sa(a) {
                switch(typeof a){
                    case "boolean":
                    case "number":
                    case "string":
                    case "undefined":
                        return a;
                    case "object":
                        return a;
                    default:
                        return "";
                }
            }
            function Ta(a) {
                var b = a.type;
                return (a = a.nodeName) && "input" === a.toLowerCase() && ("checkbox" === b || "radio" === b);
            }
            function Ua(a) {
                var b = Ta(a) ? "checked" : "value", c = Object.getOwnPropertyDescriptor(a.constructor.prototype, b), d = "" + a[b];
                if (!a.hasOwnProperty(b) && "undefined" !== typeof c && "function" === typeof c.get && "function" === typeof c.set) {
                    var e = c.get, f = c.set;
                    Object.defineProperty(a, b, {
                        configurable: true,
                        get: function() {
                            return e.call(this);
                        },
                        set: function(a2) {
                            d = "" + a2;
                            f.call(this, a2);
                        }
                    });
                    Object.defineProperty(a, b, {
                        enumerable: c.enumerable
                    });
                    return {
                        getValue: function() {
                            return d;
                        },
                        setValue: function(a2) {
                            d = "" + a2;
                        },
                        stopTracking: function() {
                            a._valueTracker = null;
                            delete a[b];
                        }
                    };
                }
            }
            function Va(a) {
                a._valueTracker || (a._valueTracker = Ua(a));
            }
            function Wa(a) {
                if (!a) return false;
                var b = a._valueTracker;
                if (!b) return true;
                var c = b.getValue();
                var d = "";
                a && (d = Ta(a) ? a.checked ? "true" : "false" : a.value);
                a = d;
                return a !== c ? (b.setValue(a), true) : false;
            }
            function Xa(a) {
                a = a || ("undefined" !== typeof document ? document : void 0);
                if ("undefined" === typeof a) return null;
                try {
                    return a.activeElement || a.body;
                } catch (b) {
                    return a.body;
                }
            }
            function Ya(a, b) {
                var c = b.checked;
                return A({}, b, {
                    defaultChecked: void 0,
                    defaultValue: void 0,
                    value: void 0,
                    checked: null != c ? c : a._wrapperState.initialChecked
                });
            }
            function Za(a, b) {
                var c = null == b.defaultValue ? "" : b.defaultValue, d = null != b.checked ? b.checked : b.defaultChecked;
                c = Sa(null != b.value ? b.value : c);
                a._wrapperState = {
                    initialChecked: d,
                    initialValue: c,
                    controlled: "checkbox" === b.type || "radio" === b.type ? null != b.checked : null != b.value
                };
            }
            function ab(a, b) {
                b = b.checked;
                null != b && ta(a, "checked", b, false);
            }
            function bb(a, b) {
                ab(a, b);
                var c = Sa(b.value), d = b.type;
                if (null != c) if ("number" === d) {
                    if (0 === c && "" === a.value || a.value != c) a.value = "" + c;
                } else a.value !== "" + c && (a.value = "" + c);
                else if ("submit" === d || "reset" === d) {
                    a.removeAttribute("value");
                    return;
                }
                b.hasOwnProperty("value") ? cb(a, b.type, c) : b.hasOwnProperty("defaultValue") && cb(a, b.type, Sa(b.defaultValue));
                null == b.checked && null != b.defaultChecked && (a.defaultChecked = !!b.defaultChecked);
            }
            function db(a, b, c) {
                if (b.hasOwnProperty("value") || b.hasOwnProperty("defaultValue")) {
                    var d = b.type;
                    if (!("submit" !== d && "reset" !== d || void 0 !== b.value && null !== b.value)) return;
                    b = "" + a._wrapperState.initialValue;
                    c || b === a.value || (a.value = b);
                    a.defaultValue = b;
                }
                c = a.name;
                "" !== c && (a.name = "");
                a.defaultChecked = !!a._wrapperState.initialChecked;
                "" !== c && (a.name = c);
            }
            function cb(a, b, c) {
                if ("number" !== b || Xa(a.ownerDocument) !== a) null == c ? a.defaultValue = "" + a._wrapperState.initialValue : a.defaultValue !== "" + c && (a.defaultValue = "" + c);
            }
            var eb = Array.isArray;
            function fb(a, b, c, d) {
                a = a.options;
                if (b) {
                    b = {};
                    for(var e = 0; e < c.length; e++)b["$" + c[e]] = true;
                    for(c = 0; c < a.length; c++)e = b.hasOwnProperty("$" + a[c].value), a[c].selected !== e && (a[c].selected = e), e && d && (a[c].defaultSelected = true);
                } else {
                    c = "" + Sa(c);
                    b = null;
                    for(e = 0; e < a.length; e++){
                        if (a[e].value === c) {
                            a[e].selected = true;
                            d && (a[e].defaultSelected = true);
                            return;
                        }
                        null !== b || a[e].disabled || (b = a[e]);
                    }
                    null !== b && (b.selected = true);
                }
            }
            function gb(a, b) {
                if (null != b.dangerouslySetInnerHTML) throw Error(p(91));
                return A({}, b, {
                    value: void 0,
                    defaultValue: void 0,
                    children: "" + a._wrapperState.initialValue
                });
            }
            function hb(a, b) {
                var c = b.value;
                if (null == c) {
                    c = b.children;
                    b = b.defaultValue;
                    if (null != c) {
                        if (null != b) throw Error(p(92));
                        if (eb(c)) {
                            if (1 < c.length) throw Error(p(93));
                            c = c[0];
                        }
                        b = c;
                    }
                    null == b && (b = "");
                    c = b;
                }
                a._wrapperState = {
                    initialValue: Sa(c)
                };
            }
            function ib(a, b) {
                var c = Sa(b.value), d = Sa(b.defaultValue);
                null != c && (c = "" + c, c !== a.value && (a.value = c), null == b.defaultValue && a.defaultValue !== c && (a.defaultValue = c));
                null != d && (a.defaultValue = "" + d);
            }
            function jb(a) {
                var b = a.textContent;
                b === a._wrapperState.initialValue && "" !== b && null !== b && (a.value = b);
            }
            function kb(a) {
                switch(a){
                    case "svg":
                        return "http://www.w3.org/2000/svg";
                    case "math":
                        return "http://www.w3.org/1998/Math/MathML";
                    default:
                        return "http://www.w3.org/1999/xhtml";
                }
            }
            function lb(a, b) {
                return null == a || "http://www.w3.org/1999/xhtml" === a ? kb(b) : "http://www.w3.org/2000/svg" === a && "foreignObject" === b ? "http://www.w3.org/1999/xhtml" : a;
            }
            var mb;
            var nb = function(a) {
                return "undefined" !== typeof MSApp && MSApp.execUnsafeLocalFunction ? function(b, c, d, e) {
                    MSApp.execUnsafeLocalFunction(function() {
                        return a(b, c, d, e);
                    });
                } : a;
            }(function(a, b) {
                if ("http://www.w3.org/2000/svg" !== a.namespaceURI || "innerHTML" in a) a.innerHTML = b;
                else {
                    mb = mb || document.createElement("div");
                    mb.innerHTML = "<svg>" + b.valueOf().toString() + "</svg>";
                    for(b = mb.firstChild; a.firstChild;)a.removeChild(a.firstChild);
                    for(; b.firstChild;)a.appendChild(b.firstChild);
                }
            });
            function ob(a, b) {
                if (b) {
                    var c = a.firstChild;
                    if (c && c === a.lastChild && 3 === c.nodeType) {
                        c.nodeValue = b;
                        return;
                    }
                }
                a.textContent = b;
            }
            var pb = {
                animationIterationCount: true,
                aspectRatio: true,
                borderImageOutset: true,
                borderImageSlice: true,
                borderImageWidth: true,
                boxFlex: true,
                boxFlexGroup: true,
                boxOrdinalGroup: true,
                columnCount: true,
                columns: true,
                flex: true,
                flexGrow: true,
                flexPositive: true,
                flexShrink: true,
                flexNegative: true,
                flexOrder: true,
                gridArea: true,
                gridRow: true,
                gridRowEnd: true,
                gridRowSpan: true,
                gridRowStart: true,
                gridColumn: true,
                gridColumnEnd: true,
                gridColumnSpan: true,
                gridColumnStart: true,
                fontWeight: true,
                lineClamp: true,
                lineHeight: true,
                opacity: true,
                order: true,
                orphans: true,
                tabSize: true,
                widows: true,
                zIndex: true,
                zoom: true,
                fillOpacity: true,
                floodOpacity: true,
                stopOpacity: true,
                strokeDasharray: true,
                strokeDashoffset: true,
                strokeMiterlimit: true,
                strokeOpacity: true,
                strokeWidth: true
            };
            var qb = [
                "Webkit",
                "ms",
                "Moz",
                "O"
            ];
            Object.keys(pb).forEach(function(a) {
                qb.forEach(function(b) {
                    b = b + a.charAt(0).toUpperCase() + a.substring(1);
                    pb[b] = pb[a];
                });
            });
            function rb(a, b, c) {
                return null == b || "boolean" === typeof b || "" === b ? "" : c || "number" !== typeof b || 0 === b || pb.hasOwnProperty(a) && pb[a] ? ("" + b).trim() : b + "px";
            }
            function sb(a, b) {
                a = a.style;
                for(var c in b)if (b.hasOwnProperty(c)) {
                    var d = 0 === c.indexOf("--"), e = rb(c, b[c], d);
                    "float" === c && (c = "cssFloat");
                    d ? a.setProperty(c, e) : a[c] = e;
                }
            }
            var tb = A({
                menuitem: true
            }, {
                area: true,
                base: true,
                br: true,
                col: true,
                embed: true,
                hr: true,
                img: true,
                input: true,
                keygen: true,
                link: true,
                meta: true,
                param: true,
                source: true,
                track: true,
                wbr: true
            });
            function ub(a, b) {
                if (b) {
                    if (tb[a] && (null != b.children || null != b.dangerouslySetInnerHTML)) throw Error(p(137, a));
                    if (null != b.dangerouslySetInnerHTML) {
                        if (null != b.children) throw Error(p(60));
                        if ("object" !== typeof b.dangerouslySetInnerHTML || !("__html" in b.dangerouslySetInnerHTML)) throw Error(p(61));
                    }
                    if (null != b.style && "object" !== typeof b.style) throw Error(p(62));
                }
            }
            function vb(a, b) {
                if (-1 === a.indexOf("-")) return "string" === typeof b.is;
                switch(a){
                    case "annotation-xml":
                    case "color-profile":
                    case "font-face":
                    case "font-face-src":
                    case "font-face-uri":
                    case "font-face-format":
                    case "font-face-name":
                    case "missing-glyph":
                        return false;
                    default:
                        return true;
                }
            }
            var wb = null;
            function xb(a) {
                a = a.target || a.srcElement || window;
                a.correspondingUseElement && (a = a.correspondingUseElement);
                return 3 === a.nodeType ? a.parentNode : a;
            }
            var yb = null;
            var zb = null;
            var Ab = null;
            function Bb(a) {
                if (a = Cb(a)) {
                    if ("function" !== typeof yb) throw Error(p(280));
                    var b = a.stateNode;
                    b && (b = Db(b), yb(a.stateNode, a.type, b));
                }
            }
            function Eb(a) {
                zb ? Ab ? Ab.push(a) : Ab = [
                    a
                ] : zb = a;
            }
            function Fb() {
                if (zb) {
                    var a = zb, b = Ab;
                    Ab = zb = null;
                    Bb(a);
                    if (b) for(a = 0; a < b.length; a++)Bb(b[a]);
                }
            }
            function Gb(a, b) {
                return a(b);
            }
            function Hb() {}
            var Ib = false;
            function Jb(a, b, c) {
                if (Ib) return a(b, c);
                Ib = true;
                try {
                    return Gb(a, b, c);
                } finally{
                    if (Ib = false, null !== zb || null !== Ab) Hb(), Fb();
                }
            }
            function Kb(a, b) {
                var c = a.stateNode;
                if (null === c) return null;
                var d = Db(c);
                if (null === d) return null;
                c = d[b];
                a: switch(b){
                    case "onClick":
                    case "onClickCapture":
                    case "onDoubleClick":
                    case "onDoubleClickCapture":
                    case "onMouseDown":
                    case "onMouseDownCapture":
                    case "onMouseMove":
                    case "onMouseMoveCapture":
                    case "onMouseUp":
                    case "onMouseUpCapture":
                    case "onMouseEnter":
                        (d = !d.disabled) || (a = a.type, d = !("button" === a || "input" === a || "select" === a || "textarea" === a));
                        a = !d;
                        break a;
                    default:
                        a = false;
                }
                if (a) return null;
                if (c && "function" !== typeof c) throw Error(p(231, b, typeof c));
                return c;
            }
            var Lb = false;
            if (ia) try {
                Mb = {};
                Object.defineProperty(Mb, "passive", {
                    get: function() {
                        Lb = true;
                    }
                });
                window.addEventListener("test", Mb, Mb);
                window.removeEventListener("test", Mb, Mb);
            } catch (a) {
                Lb = false;
            }
            var Mb;
            function Nb(a, b, c, d, e, f, g, h, k) {
                var l = Array.prototype.slice.call(arguments, 3);
                try {
                    b.apply(c, l);
                } catch (m) {
                    this.onError(m);
                }
            }
            var Ob = false;
            var Pb = null;
            var Qb = false;
            var Rb = null;
            var Sb = {
                onError: function(a) {
                    Ob = true;
                    Pb = a;
                }
            };
            function Tb(a, b, c, d, e, f, g, h, k) {
                Ob = false;
                Pb = null;
                Nb.apply(Sb, arguments);
            }
            function Ub(a, b, c, d, e, f, g, h, k) {
                Tb.apply(this, arguments);
                if (Ob) {
                    if (Ob) {
                        var l = Pb;
                        Ob = false;
                        Pb = null;
                    } else throw Error(p(198));
                    Qb || (Qb = true, Rb = l);
                }
            }
            function Vb(a) {
                var b = a, c = a;
                if (a.alternate) for(; b.return;)b = b.return;
                else {
                    a = b;
                    do b = a, 0 !== (b.flags & 4098) && (c = b.return), a = b.return;
                    while (a)
                }
                return 3 === b.tag ? c : null;
            }
            function Wb(a) {
                if (13 === a.tag) {
                    var b = a.memoizedState;
                    null === b && (a = a.alternate, null !== a && (b = a.memoizedState));
                    if (null !== b) return b.dehydrated;
                }
                return null;
            }
            function Xb(a) {
                if (Vb(a) !== a) throw Error(p(188));
            }
            function Yb(a) {
                var b = a.alternate;
                if (!b) {
                    b = Vb(a);
                    if (null === b) throw Error(p(188));
                    return b !== a ? null : a;
                }
                for(var c = a, d = b;;){
                    var e = c.return;
                    if (null === e) break;
                    var f = e.alternate;
                    if (null === f) {
                        d = e.return;
                        if (null !== d) {
                            c = d;
                            continue;
                        }
                        break;
                    }
                    if (e.child === f.child) {
                        for(f = e.child; f;){
                            if (f === c) return Xb(e), a;
                            if (f === d) return Xb(e), b;
                            f = f.sibling;
                        }
                        throw Error(p(188));
                    }
                    if (c.return !== d.return) c = e, d = f;
                    else {
                        for(var g = false, h = e.child; h;){
                            if (h === c) {
                                g = true;
                                c = e;
                                d = f;
                                break;
                            }
                            if (h === d) {
                                g = true;
                                d = e;
                                c = f;
                                break;
                            }
                            h = h.sibling;
                        }
                        if (!g) {
                            for(h = f.child; h;){
                                if (h === c) {
                                    g = true;
                                    c = f;
                                    d = e;
                                    break;
                                }
                                if (h === d) {
                                    g = true;
                                    d = f;
                                    c = e;
                                    break;
                                }
                                h = h.sibling;
                            }
                            if (!g) throw Error(p(189));
                        }
                    }
                    if (c.alternate !== d) throw Error(p(190));
                }
                if (3 !== c.tag) throw Error(p(188));
                return c.stateNode.current === c ? a : b;
            }
            function Zb(a) {
                a = Yb(a);
                return null !== a ? $b(a) : null;
            }
            function $b(a) {
                if (5 === a.tag || 6 === a.tag) return a;
                for(a = a.child; null !== a;){
                    var b = $b(a);
                    if (null !== b) return b;
                    a = a.sibling;
                }
                return null;
            }
            var ac = ca.unstable_scheduleCallback;
            var bc = ca.unstable_cancelCallback;
            var cc = ca.unstable_shouldYield;
            var dc = ca.unstable_requestPaint;
            var B = ca.unstable_now;
            var ec = ca.unstable_getCurrentPriorityLevel;
            var fc = ca.unstable_ImmediatePriority;
            var gc = ca.unstable_UserBlockingPriority;
            var hc = ca.unstable_NormalPriority;
            var ic = ca.unstable_LowPriority;
            var jc = ca.unstable_IdlePriority;
            var kc = null;
            var lc = null;
            function mc(a) {
                if (lc && "function" === typeof lc.onCommitFiberRoot) try {
                    lc.onCommitFiberRoot(kc, a, void 0, 128 === (a.current.flags & 128));
                } catch (b) {}
            }
            var oc = Math.clz32 ? Math.clz32 : nc;
            var pc = Math.log;
            var qc = Math.LN2;
            function nc(a) {
                a >>>= 0;
                return 0 === a ? 32 : 31 - (pc(a) / qc | 0) | 0;
            }
            var rc = 64;
            var sc = 4194304;
            function tc(a) {
                switch(a & -a){
                    case 1:
                        return 1;
                    case 2:
                        return 2;
                    case 4:
                        return 4;
                    case 8:
                        return 8;
                    case 16:
                        return 16;
                    case 32:
                        return 32;
                    case 64:
                    case 128:
                    case 256:
                    case 512:
                    case 1024:
                    case 2048:
                    case 4096:
                    case 8192:
                    case 16384:
                    case 32768:
                    case 65536:
                    case 131072:
                    case 262144:
                    case 524288:
                    case 1048576:
                    case 2097152:
                        return a & 4194240;
                    case 4194304:
                    case 8388608:
                    case 16777216:
                    case 33554432:
                    case 67108864:
                        return a & 130023424;
                    case 134217728:
                        return 134217728;
                    case 268435456:
                        return 268435456;
                    case 536870912:
                        return 536870912;
                    case 1073741824:
                        return 1073741824;
                    default:
                        return a;
                }
            }
            function uc(a, b) {
                var c = a.pendingLanes;
                if (0 === c) return 0;
                var d = 0, e = a.suspendedLanes, f = a.pingedLanes, g = c & 268435455;
                if (0 !== g) {
                    var h = g & ~e;
                    0 !== h ? d = tc(h) : (f &= g, 0 !== f && (d = tc(f)));
                } else g = c & ~e, 0 !== g ? d = tc(g) : 0 !== f && (d = tc(f));
                if (0 === d) return 0;
                if (0 !== b && b !== d && 0 === (b & e) && (e = d & -d, f = b & -b, e >= f || 16 === e && 0 !== (f & 4194240))) return b;
                0 !== (d & 4) && (d |= c & 16);
                b = a.entangledLanes;
                if (0 !== b) for(a = a.entanglements, b &= d; 0 < b;)c = 31 - oc(b), e = 1 << c, d |= a[c], b &= ~e;
                return d;
            }
            function vc(a, b) {
                switch(a){
                    case 1:
                    case 2:
                    case 4:
                        return b + 250;
                    case 8:
                    case 16:
                    case 32:
                    case 64:
                    case 128:
                    case 256:
                    case 512:
                    case 1024:
                    case 2048:
                    case 4096:
                    case 8192:
                    case 16384:
                    case 32768:
                    case 65536:
                    case 131072:
                    case 262144:
                    case 524288:
                    case 1048576:
                    case 2097152:
                        return b + 5e3;
                    case 4194304:
                    case 8388608:
                    case 16777216:
                    case 33554432:
                    case 67108864:
                        return -1;
                    case 134217728:
                    case 268435456:
                    case 536870912:
                    case 1073741824:
                        return -1;
                    default:
                        return -1;
                }
            }
            function wc(a, b) {
                for(var c = a.suspendedLanes, d = a.pingedLanes, e = a.expirationTimes, f = a.pendingLanes; 0 < f;){
                    var g = 31 - oc(f), h = 1 << g, k = e[g];
                    if (-1 === k) {
                        if (0 === (h & c) || 0 !== (h & d)) e[g] = vc(h, b);
                    } else k <= b && (a.expiredLanes |= h);
                    f &= ~h;
                }
            }
            function xc(a) {
                a = a.pendingLanes & -1073741825;
                return 0 !== a ? a : a & 1073741824 ? 1073741824 : 0;
            }
            function yc() {
                var a = rc;
                rc <<= 1;
                0 === (rc & 4194240) && (rc = 64);
                return a;
            }
            function zc(a) {
                for(var b = [], c = 0; 31 > c; c++)b.push(a);
                return b;
            }
            function Ac(a, b, c) {
                a.pendingLanes |= b;
                536870912 !== b && (a.suspendedLanes = 0, a.pingedLanes = 0);
                a = a.eventTimes;
                b = 31 - oc(b);
                a[b] = c;
            }
            function Bc(a, b) {
                var c = a.pendingLanes & ~b;
                a.pendingLanes = b;
                a.suspendedLanes = 0;
                a.pingedLanes = 0;
                a.expiredLanes &= b;
                a.mutableReadLanes &= b;
                a.entangledLanes &= b;
                b = a.entanglements;
                var d = a.eventTimes;
                for(a = a.expirationTimes; 0 < c;){
                    var e = 31 - oc(c), f = 1 << e;
                    b[e] = 0;
                    d[e] = -1;
                    a[e] = -1;
                    c &= ~f;
                }
            }
            function Cc(a, b) {
                var c = a.entangledLanes |= b;
                for(a = a.entanglements; c;){
                    var d = 31 - oc(c), e = 1 << d;
                    e & b | a[d] & b && (a[d] |= b);
                    c &= ~e;
                }
            }
            var C = 0;
            function Dc(a) {
                a &= -a;
                return 1 < a ? 4 < a ? 0 !== (a & 268435455) ? 16 : 536870912 : 4 : 1;
            }
            var Ec;
            var Fc;
            var Gc;
            var Hc;
            var Ic;
            var Jc = false;
            var Kc = [];
            var Lc = null;
            var Mc = null;
            var Nc = null;
            var Oc = /* @__PURE__ */ new Map();
            var Pc = /* @__PURE__ */ new Map();
            var Qc = [];
            var Rc = "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset submit".split(" ");
            function Sc(a, b) {
                switch(a){
                    case "focusin":
                    case "focusout":
                        Lc = null;
                        break;
                    case "dragenter":
                    case "dragleave":
                        Mc = null;
                        break;
                    case "mouseover":
                    case "mouseout":
                        Nc = null;
                        break;
                    case "pointerover":
                    case "pointerout":
                        Oc.delete(b.pointerId);
                        break;
                    case "gotpointercapture":
                    case "lostpointercapture":
                        Pc.delete(b.pointerId);
                }
            }
            function Tc(a, b, c, d, e, f) {
                if (null === a || a.nativeEvent !== f) return a = {
                    blockedOn: b,
                    domEventName: c,
                    eventSystemFlags: d,
                    nativeEvent: f,
                    targetContainers: [
                        e
                    ]
                }, null !== b && (b = Cb(b), null !== b && Fc(b)), a;
                a.eventSystemFlags |= d;
                b = a.targetContainers;
                null !== e && -1 === b.indexOf(e) && b.push(e);
                return a;
            }
            function Uc(a, b, c, d, e) {
                switch(b){
                    case "focusin":
                        return Lc = Tc(Lc, a, b, c, d, e), true;
                    case "dragenter":
                        return Mc = Tc(Mc, a, b, c, d, e), true;
                    case "mouseover":
                        return Nc = Tc(Nc, a, b, c, d, e), true;
                    case "pointerover":
                        var f = e.pointerId;
                        Oc.set(f, Tc(Oc.get(f) || null, a, b, c, d, e));
                        return true;
                    case "gotpointercapture":
                        return f = e.pointerId, Pc.set(f, Tc(Pc.get(f) || null, a, b, c, d, e)), true;
                }
                return false;
            }
            function Vc(a) {
                var b = Wc(a.target);
                if (null !== b) {
                    var c = Vb(b);
                    if (null !== c) {
                        if (b = c.tag, 13 === b) {
                            if (b = Wb(c), null !== b) {
                                a.blockedOn = b;
                                Ic(a.priority, function() {
                                    Gc(c);
                                });
                                return;
                            }
                        } else if (3 === b && c.stateNode.current.memoizedState.isDehydrated) {
                            a.blockedOn = 3 === c.tag ? c.stateNode.containerInfo : null;
                            return;
                        }
                    }
                }
                a.blockedOn = null;
            }
            function Xc(a) {
                if (null !== a.blockedOn) return false;
                for(var b = a.targetContainers; 0 < b.length;){
                    var c = Yc(a.domEventName, a.eventSystemFlags, b[0], a.nativeEvent);
                    if (null === c) {
                        c = a.nativeEvent;
                        var d = new c.constructor(c.type, c);
                        wb = d;
                        c.target.dispatchEvent(d);
                        wb = null;
                    } else return b = Cb(c), null !== b && Fc(b), a.blockedOn = c, false;
                    b.shift();
                }
                return true;
            }
            function Zc(a, b, c) {
                Xc(a) && c.delete(b);
            }
            function $c() {
                Jc = false;
                null !== Lc && Xc(Lc) && (Lc = null);
                null !== Mc && Xc(Mc) && (Mc = null);
                null !== Nc && Xc(Nc) && (Nc = null);
                Oc.forEach(Zc);
                Pc.forEach(Zc);
            }
            function ad(a, b) {
                a.blockedOn === b && (a.blockedOn = null, Jc || (Jc = true, ca.unstable_scheduleCallback(ca.unstable_NormalPriority, $c)));
            }
            function bd(a) {
                function b(b2) {
                    return ad(b2, a);
                }
                if (0 < Kc.length) {
                    ad(Kc[0], a);
                    for(var c = 1; c < Kc.length; c++){
                        var d = Kc[c];
                        d.blockedOn === a && (d.blockedOn = null);
                    }
                }
                null !== Lc && ad(Lc, a);
                null !== Mc && ad(Mc, a);
                null !== Nc && ad(Nc, a);
                Oc.forEach(b);
                Pc.forEach(b);
                for(c = 0; c < Qc.length; c++)d = Qc[c], d.blockedOn === a && (d.blockedOn = null);
                for(; 0 < Qc.length && (c = Qc[0], null === c.blockedOn);)Vc(c), null === c.blockedOn && Qc.shift();
            }
            var cd = ua.ReactCurrentBatchConfig;
            var dd = true;
            function ed(a, b, c, d) {
                var e = C, f = cd.transition;
                cd.transition = null;
                try {
                    C = 1, fd(a, b, c, d);
                } finally{
                    C = e, cd.transition = f;
                }
            }
            function gd(a, b, c, d) {
                var e = C, f = cd.transition;
                cd.transition = null;
                try {
                    C = 4, fd(a, b, c, d);
                } finally{
                    C = e, cd.transition = f;
                }
            }
            function fd(a, b, c, d) {
                if (dd) {
                    var e = Yc(a, b, c, d);
                    if (null === e) hd(a, b, d, id, c), Sc(a, d);
                    else if (Uc(e, a, b, c, d)) d.stopPropagation();
                    else if (Sc(a, d), b & 4 && -1 < Rc.indexOf(a)) {
                        for(; null !== e;){
                            var f = Cb(e);
                            null !== f && Ec(f);
                            f = Yc(a, b, c, d);
                            null === f && hd(a, b, d, id, c);
                            if (f === e) break;
                            e = f;
                        }
                        null !== e && d.stopPropagation();
                    } else hd(a, b, d, null, c);
                }
            }
            var id = null;
            function Yc(a, b, c, d) {
                id = null;
                a = xb(d);
                a = Wc(a);
                if (null !== a) if (b = Vb(a), null === b) a = null;
                else if (c = b.tag, 13 === c) {
                    a = Wb(b);
                    if (null !== a) return a;
                    a = null;
                } else if (3 === c) {
                    if (b.stateNode.current.memoizedState.isDehydrated) return 3 === b.tag ? b.stateNode.containerInfo : null;
                    a = null;
                } else b !== a && (a = null);
                id = a;
                return null;
            }
            function jd(a) {
                switch(a){
                    case "cancel":
                    case "click":
                    case "close":
                    case "contextmenu":
                    case "copy":
                    case "cut":
                    case "auxclick":
                    case "dblclick":
                    case "dragend":
                    case "dragstart":
                    case "drop":
                    case "focusin":
                    case "focusout":
                    case "input":
                    case "invalid":
                    case "keydown":
                    case "keypress":
                    case "keyup":
                    case "mousedown":
                    case "mouseup":
                    case "paste":
                    case "pause":
                    case "play":
                    case "pointercancel":
                    case "pointerdown":
                    case "pointerup":
                    case "ratechange":
                    case "reset":
                    case "resize":
                    case "seeked":
                    case "submit":
                    case "touchcancel":
                    case "touchend":
                    case "touchstart":
                    case "volumechange":
                    case "change":
                    case "selectionchange":
                    case "textInput":
                    case "compositionstart":
                    case "compositionend":
                    case "compositionupdate":
                    case "beforeblur":
                    case "afterblur":
                    case "beforeinput":
                    case "blur":
                    case "fullscreenchange":
                    case "focus":
                    case "hashchange":
                    case "popstate":
                    case "select":
                    case "selectstart":
                        return 1;
                    case "drag":
                    case "dragenter":
                    case "dragexit":
                    case "dragleave":
                    case "dragover":
                    case "mousemove":
                    case "mouseout":
                    case "mouseover":
                    case "pointermove":
                    case "pointerout":
                    case "pointerover":
                    case "scroll":
                    case "toggle":
                    case "touchmove":
                    case "wheel":
                    case "mouseenter":
                    case "mouseleave":
                    case "pointerenter":
                    case "pointerleave":
                        return 4;
                    case "message":
                        switch(ec()){
                            case fc:
                                return 1;
                            case gc:
                                return 4;
                            case hc:
                            case ic:
                                return 16;
                            case jc:
                                return 536870912;
                            default:
                                return 16;
                        }
                    default:
                        return 16;
                }
            }
            var kd = null;
            var ld = null;
            var md = null;
            function nd() {
                if (md) return md;
                var a, b = ld, c = b.length, d, e = "value" in kd ? kd.value : kd.textContent, f = e.length;
                for(a = 0; a < c && b[a] === e[a]; a++);
                var g = c - a;
                for(d = 1; d <= g && b[c - d] === e[f - d]; d++);
                return md = e.slice(a, 1 < d ? 1 - d : void 0);
            }
            function od(a) {
                var b = a.keyCode;
                "charCode" in a ? (a = a.charCode, 0 === a && 13 === b && (a = 13)) : a = b;
                10 === a && (a = 13);
                return 32 <= a || 13 === a ? a : 0;
            }
            function pd() {
                return true;
            }
            function qd() {
                return false;
            }
            function rd(a) {
                function b(b2, d, e, f, g) {
                    this._reactName = b2;
                    this._targetInst = e;
                    this.type = d;
                    this.nativeEvent = f;
                    this.target = g;
                    this.currentTarget = null;
                    for(var c in a)a.hasOwnProperty(c) && (b2 = a[c], this[c] = b2 ? b2(f) : f[c]);
                    this.isDefaultPrevented = (null != f.defaultPrevented ? f.defaultPrevented : false === f.returnValue) ? pd : qd;
                    this.isPropagationStopped = qd;
                    return this;
                }
                A(b.prototype, {
                    preventDefault: function() {
                        this.defaultPrevented = true;
                        var a2 = this.nativeEvent;
                        a2 && (a2.preventDefault ? a2.preventDefault() : "unknown" !== typeof a2.returnValue && (a2.returnValue = false), this.isDefaultPrevented = pd);
                    },
                    stopPropagation: function() {
                        var a2 = this.nativeEvent;
                        a2 && (a2.stopPropagation ? a2.stopPropagation() : "unknown" !== typeof a2.cancelBubble && (a2.cancelBubble = true), this.isPropagationStopped = pd);
                    },
                    persist: function() {},
                    isPersistent: pd
                });
                return b;
            }
            var sd = {
                eventPhase: 0,
                bubbles: 0,
                cancelable: 0,
                timeStamp: function(a) {
                    return a.timeStamp || Date.now();
                },
                defaultPrevented: 0,
                isTrusted: 0
            };
            var td = rd(sd);
            var ud = A({}, sd, {
                view: 0,
                detail: 0
            });
            var vd = rd(ud);
            var wd;
            var xd;
            var yd;
            var Ad = A({}, ud, {
                screenX: 0,
                screenY: 0,
                clientX: 0,
                clientY: 0,
                pageX: 0,
                pageY: 0,
                ctrlKey: 0,
                shiftKey: 0,
                altKey: 0,
                metaKey: 0,
                getModifierState: zd,
                button: 0,
                buttons: 0,
                relatedTarget: function(a) {
                    return void 0 === a.relatedTarget ? a.fromElement === a.srcElement ? a.toElement : a.fromElement : a.relatedTarget;
                },
                movementX: function(a) {
                    if ("movementX" in a) return a.movementX;
                    a !== yd && (yd && "mousemove" === a.type ? (wd = a.screenX - yd.screenX, xd = a.screenY - yd.screenY) : xd = wd = 0, yd = a);
                    return wd;
                },
                movementY: function(a) {
                    return "movementY" in a ? a.movementY : xd;
                }
            });
            var Bd = rd(Ad);
            var Cd = A({}, Ad, {
                dataTransfer: 0
            });
            var Dd = rd(Cd);
            var Ed = A({}, ud, {
                relatedTarget: 0
            });
            var Fd = rd(Ed);
            var Gd = A({}, sd, {
                animationName: 0,
                elapsedTime: 0,
                pseudoElement: 0
            });
            var Hd = rd(Gd);
            var Id = A({}, sd, {
                clipboardData: function(a) {
                    return "clipboardData" in a ? a.clipboardData : window.clipboardData;
                }
            });
            var Jd = rd(Id);
            var Kd = A({}, sd, {
                data: 0
            });
            var Ld = rd(Kd);
            var Md = {
                Esc: "Escape",
                Spacebar: " ",
                Left: "ArrowLeft",
                Up: "ArrowUp",
                Right: "ArrowRight",
                Down: "ArrowDown",
                Del: "Delete",
                Win: "OS",
                Menu: "ContextMenu",
                Apps: "ContextMenu",
                Scroll: "ScrollLock",
                MozPrintableKey: "Unidentified"
            };
            var Nd = {
                8: "Backspace",
                9: "Tab",
                12: "Clear",
                13: "Enter",
                16: "Shift",
                17: "Control",
                18: "Alt",
                19: "Pause",
                20: "CapsLock",
                27: "Escape",
                32: " ",
                33: "PageUp",
                34: "PageDown",
                35: "End",
                36: "Home",
                37: "ArrowLeft",
                38: "ArrowUp",
                39: "ArrowRight",
                40: "ArrowDown",
                45: "Insert",
                46: "Delete",
                112: "F1",
                113: "F2",
                114: "F3",
                115: "F4",
                116: "F5",
                117: "F6",
                118: "F7",
                119: "F8",
                120: "F9",
                121: "F10",
                122: "F11",
                123: "F12",
                144: "NumLock",
                145: "ScrollLock",
                224: "Meta"
            };
            var Od = {
                Alt: "altKey",
                Control: "ctrlKey",
                Meta: "metaKey",
                Shift: "shiftKey"
            };
            function Pd(a) {
                var b = this.nativeEvent;
                return b.getModifierState ? b.getModifierState(a) : (a = Od[a]) ? !!b[a] : false;
            }
            function zd() {
                return Pd;
            }
            var Qd = A({}, ud, {
                key: function(a) {
                    if (a.key) {
                        var b = Md[a.key] || a.key;
                        if ("Unidentified" !== b) return b;
                    }
                    return "keypress" === a.type ? (a = od(a), 13 === a ? "Enter" : String.fromCharCode(a)) : "keydown" === a.type || "keyup" === a.type ? Nd[a.keyCode] || "Unidentified" : "";
                },
                code: 0,
                location: 0,
                ctrlKey: 0,
                shiftKey: 0,
                altKey: 0,
                metaKey: 0,
                repeat: 0,
                locale: 0,
                getModifierState: zd,
                charCode: function(a) {
                    return "keypress" === a.type ? od(a) : 0;
                },
                keyCode: function(a) {
                    return "keydown" === a.type || "keyup" === a.type ? a.keyCode : 0;
                },
                which: function(a) {
                    return "keypress" === a.type ? od(a) : "keydown" === a.type || "keyup" === a.type ? a.keyCode : 0;
                }
            });
            var Rd = rd(Qd);
            var Sd = A({}, Ad, {
                pointerId: 0,
                width: 0,
                height: 0,
                pressure: 0,
                tangentialPressure: 0,
                tiltX: 0,
                tiltY: 0,
                twist: 0,
                pointerType: 0,
                isPrimary: 0
            });
            var Td = rd(Sd);
            var Ud = A({}, ud, {
                touches: 0,
                targetTouches: 0,
                changedTouches: 0,
                altKey: 0,
                metaKey: 0,
                ctrlKey: 0,
                shiftKey: 0,
                getModifierState: zd
            });
            var Vd = rd(Ud);
            var Wd = A({}, sd, {
                propertyName: 0,
                elapsedTime: 0,
                pseudoElement: 0
            });
            var Xd = rd(Wd);
            var Yd = A({}, Ad, {
                deltaX: function(a) {
                    return "deltaX" in a ? a.deltaX : "wheelDeltaX" in a ? -a.wheelDeltaX : 0;
                },
                deltaY: function(a) {
                    return "deltaY" in a ? a.deltaY : "wheelDeltaY" in a ? -a.wheelDeltaY : "wheelDelta" in a ? -a.wheelDelta : 0;
                },
                deltaZ: 0,
                deltaMode: 0
            });
            var Zd = rd(Yd);
            var $d = [
                9,
                13,
                27,
                32
            ];
            var ae = ia && "CompositionEvent" in window;
            var be = null;
            ia && "documentMode" in document && (be = document.documentMode);
            var ce = ia && "TextEvent" in window && !be;
            var de = ia && (!ae || be && 8 < be && 11 >= be);
            var ee = String.fromCharCode(32);
            var fe = false;
            function ge(a, b) {
                switch(a){
                    case "keyup":
                        return -1 !== $d.indexOf(b.keyCode);
                    case "keydown":
                        return 229 !== b.keyCode;
                    case "keypress":
                    case "mousedown":
                    case "focusout":
                        return true;
                    default:
                        return false;
                }
            }
            function he(a) {
                a = a.detail;
                return "object" === typeof a && "data" in a ? a.data : null;
            }
            var ie = false;
            function je(a, b) {
                switch(a){
                    case "compositionend":
                        return he(b);
                    case "keypress":
                        if (32 !== b.which) return null;
                        fe = true;
                        return ee;
                    case "textInput":
                        return a = b.data, a === ee && fe ? null : a;
                    default:
                        return null;
                }
            }
            function ke(a, b) {
                if (ie) return "compositionend" === a || !ae && ge(a, b) ? (a = nd(), md = ld = kd = null, ie = false, a) : null;
                switch(a){
                    case "paste":
                        return null;
                    case "keypress":
                        if (!(b.ctrlKey || b.altKey || b.metaKey) || b.ctrlKey && b.altKey) {
                            if (b.char && 1 < b.char.length) return b.char;
                            if (b.which) return String.fromCharCode(b.which);
                        }
                        return null;
                    case "compositionend":
                        return de && "ko" !== b.locale ? null : b.data;
                    default:
                        return null;
                }
            }
            var le = {
                color: true,
                date: true,
                datetime: true,
                "datetime-local": true,
                email: true,
                month: true,
                number: true,
                password: true,
                range: true,
                search: true,
                tel: true,
                text: true,
                time: true,
                url: true,
                week: true
            };
            function me(a) {
                var b = a && a.nodeName && a.nodeName.toLowerCase();
                return "input" === b ? !!le[a.type] : "textarea" === b ? true : false;
            }
            function ne(a, b, c, d) {
                Eb(d);
                b = oe(b, "onChange");
                0 < b.length && (c = new td("onChange", "change", null, c, d), a.push({
                    event: c,
                    listeners: b
                }));
            }
            var pe = null;
            var qe = null;
            function re(a) {
                se(a, 0);
            }
            function te(a) {
                var b = ue(a);
                if (Wa(b)) return a;
            }
            function ve(a, b) {
                if ("change" === a) return b;
            }
            var we = false;
            if (ia) {
                if (ia) {
                    ye = "oninput" in document;
                    if (!ye) {
                        ze = document.createElement("div");
                        ze.setAttribute("oninput", "return;");
                        ye = "function" === typeof ze.oninput;
                    }
                    xe = ye;
                } else xe = false;
                we = xe && (!document.documentMode || 9 < document.documentMode);
            }
            var xe;
            var ye;
            var ze;
            function Ae() {
                pe && (pe.detachEvent("onpropertychange", Be), qe = pe = null);
            }
            function Be(a) {
                if ("value" === a.propertyName && te(qe)) {
                    var b = [];
                    ne(b, qe, a, xb(a));
                    Jb(re, b);
                }
            }
            function Ce(a, b, c) {
                "focusin" === a ? (Ae(), pe = b, qe = c, pe.attachEvent("onpropertychange", Be)) : "focusout" === a && Ae();
            }
            function De(a) {
                if ("selectionchange" === a || "keyup" === a || "keydown" === a) return te(qe);
            }
            function Ee(a, b) {
                if ("click" === a) return te(b);
            }
            function Fe(a, b) {
                if ("input" === a || "change" === a) return te(b);
            }
            function Ge(a, b) {
                return a === b && (0 !== a || 1 / a === 1 / b) || a !== a && b !== b;
            }
            var He = "function" === typeof Object.is ? Object.is : Ge;
            function Ie(a, b) {
                if (He(a, b)) return true;
                if ("object" !== typeof a || null === a || "object" !== typeof b || null === b) return false;
                var c = Object.keys(a), d = Object.keys(b);
                if (c.length !== d.length) return false;
                for(d = 0; d < c.length; d++){
                    var e = c[d];
                    if (!ja.call(b, e) || !He(a[e], b[e])) return false;
                }
                return true;
            }
            function Je(a) {
                for(; a && a.firstChild;)a = a.firstChild;
                return a;
            }
            function Ke(a, b) {
                var c = Je(a);
                a = 0;
                for(var d; c;){
                    if (3 === c.nodeType) {
                        d = a + c.textContent.length;
                        if (a <= b && d >= b) return {
                            node: c,
                            offset: b - a
                        };
                        a = d;
                    }
                    a: {
                        for(; c;){
                            if (c.nextSibling) {
                                c = c.nextSibling;
                                break a;
                            }
                            c = c.parentNode;
                        }
                        c = void 0;
                    }
                    c = Je(c);
                }
            }
            function Le(a, b) {
                return a && b ? a === b ? true : a && 3 === a.nodeType ? false : b && 3 === b.nodeType ? Le(a, b.parentNode) : "contains" in a ? a.contains(b) : a.compareDocumentPosition ? !!(a.compareDocumentPosition(b) & 16) : false : false;
            }
            function Me() {
                for(var a = window, b = Xa(); b instanceof a.HTMLIFrameElement;){
                    try {
                        var c = "string" === typeof b.contentWindow.location.href;
                    } catch (d) {
                        c = false;
                    }
                    if (c) a = b.contentWindow;
                    else break;
                    b = Xa(a.document);
                }
                return b;
            }
            function Ne(a) {
                var b = a && a.nodeName && a.nodeName.toLowerCase();
                return b && ("input" === b && ("text" === a.type || "search" === a.type || "tel" === a.type || "url" === a.type || "password" === a.type) || "textarea" === b || "true" === a.contentEditable);
            }
            function Oe(a) {
                var b = Me(), c = a.focusedElem, d = a.selectionRange;
                if (b !== c && c && c.ownerDocument && Le(c.ownerDocument.documentElement, c)) {
                    if (null !== d && Ne(c)) {
                        if (b = d.start, a = d.end, void 0 === a && (a = b), "selectionStart" in c) c.selectionStart = b, c.selectionEnd = Math.min(a, c.value.length);
                        else if (a = (b = c.ownerDocument || document) && b.defaultView || window, a.getSelection) {
                            a = a.getSelection();
                            var e = c.textContent.length, f = Math.min(d.start, e);
                            d = void 0 === d.end ? f : Math.min(d.end, e);
                            !a.extend && f > d && (e = d, d = f, f = e);
                            e = Ke(c, f);
                            var g = Ke(c, d);
                            e && g && (1 !== a.rangeCount || a.anchorNode !== e.node || a.anchorOffset !== e.offset || a.focusNode !== g.node || a.focusOffset !== g.offset) && (b = b.createRange(), b.setStart(e.node, e.offset), a.removeAllRanges(), f > d ? (a.addRange(b), a.extend(g.node, g.offset)) : (b.setEnd(g.node, g.offset), a.addRange(b)));
                        }
                    }
                    b = [];
                    for(a = c; a = a.parentNode;)1 === a.nodeType && b.push({
                        element: a,
                        left: a.scrollLeft,
                        top: a.scrollTop
                    });
                    "function" === typeof c.focus && c.focus();
                    for(c = 0; c < b.length; c++)a = b[c], a.element.scrollLeft = a.left, a.element.scrollTop = a.top;
                }
            }
            var Pe = ia && "documentMode" in document && 11 >= document.documentMode;
            var Qe = null;
            var Re = null;
            var Se = null;
            var Te = false;
            function Ue(a, b, c) {
                var d = c.window === c ? c.document : 9 === c.nodeType ? c : c.ownerDocument;
                Te || null == Qe || Qe !== Xa(d) || (d = Qe, "selectionStart" in d && Ne(d) ? d = {
                    start: d.selectionStart,
                    end: d.selectionEnd
                } : (d = (d.ownerDocument && d.ownerDocument.defaultView || window).getSelection(), d = {
                    anchorNode: d.anchorNode,
                    anchorOffset: d.anchorOffset,
                    focusNode: d.focusNode,
                    focusOffset: d.focusOffset
                }), Se && Ie(Se, d) || (Se = d, d = oe(Re, "onSelect"), 0 < d.length && (b = new td("onSelect", "select", null, b, c), a.push({
                    event: b,
                    listeners: d
                }), b.target = Qe)));
            }
            function Ve(a, b) {
                var c = {};
                c[a.toLowerCase()] = b.toLowerCase();
                c["Webkit" + a] = "webkit" + b;
                c["Moz" + a] = "moz" + b;
                return c;
            }
            var We = {
                animationend: Ve("Animation", "AnimationEnd"),
                animationiteration: Ve("Animation", "AnimationIteration"),
                animationstart: Ve("Animation", "AnimationStart"),
                transitionend: Ve("Transition", "TransitionEnd")
            };
            var Xe = {};
            var Ye = {};
            ia && (Ye = document.createElement("div").style, "AnimationEvent" in window || (delete We.animationend.animation, delete We.animationiteration.animation, delete We.animationstart.animation), "TransitionEvent" in window || delete We.transitionend.transition);
            function Ze(a) {
                if (Xe[a]) return Xe[a];
                if (!We[a]) return a;
                var b = We[a], c;
                for(c in b)if (b.hasOwnProperty(c) && c in Ye) return Xe[a] = b[c];
                return a;
            }
            var $e = Ze("animationend");
            var af = Ze("animationiteration");
            var bf = Ze("animationstart");
            var cf = Ze("transitionend");
            var df = /* @__PURE__ */ new Map();
            var ef = "abort auxClick cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");
            function ff(a, b) {
                df.set(a, b);
                fa(b, [
                    a
                ]);
            }
            for(gf = 0; gf < ef.length; gf++){
                hf = ef[gf], jf = hf.toLowerCase(), kf = hf[0].toUpperCase() + hf.slice(1);
                ff(jf, "on" + kf);
            }
            var hf;
            var jf;
            var kf;
            var gf;
            ff($e, "onAnimationEnd");
            ff(af, "onAnimationIteration");
            ff(bf, "onAnimationStart");
            ff("dblclick", "onDoubleClick");
            ff("focusin", "onFocus");
            ff("focusout", "onBlur");
            ff(cf, "onTransitionEnd");
            ha("onMouseEnter", [
                "mouseout",
                "mouseover"
            ]);
            ha("onMouseLeave", [
                "mouseout",
                "mouseover"
            ]);
            ha("onPointerEnter", [
                "pointerout",
                "pointerover"
            ]);
            ha("onPointerLeave", [
                "pointerout",
                "pointerover"
            ]);
            fa("onChange", "change click focusin focusout input keydown keyup selectionchange".split(" "));
            fa("onSelect", "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" "));
            fa("onBeforeInput", [
                "compositionend",
                "keypress",
                "textInput",
                "paste"
            ]);
            fa("onCompositionEnd", "compositionend focusout keydown keypress keyup mousedown".split(" "));
            fa("onCompositionStart", "compositionstart focusout keydown keypress keyup mousedown".split(" "));
            fa("onCompositionUpdate", "compositionupdate focusout keydown keypress keyup mousedown".split(" "));
            var lf = "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" ");
            var mf = new Set("cancel close invalid load scroll toggle".split(" ").concat(lf));
            function nf(a, b, c) {
                var d = a.type || "unknown-event";
                a.currentTarget = c;
                Ub(d, b, void 0, a);
                a.currentTarget = null;
            }
            function se(a, b) {
                b = 0 !== (b & 4);
                for(var c = 0; c < a.length; c++){
                    var d = a[c], e = d.event;
                    d = d.listeners;
                    a: {
                        var f = void 0;
                        if (b) for(var g = d.length - 1; 0 <= g; g--){
                            var h = d[g], k = h.instance, l = h.currentTarget;
                            h = h.listener;
                            if (k !== f && e.isPropagationStopped()) break a;
                            nf(e, h, l);
                            f = k;
                        }
                        else for(g = 0; g < d.length; g++){
                            h = d[g];
                            k = h.instance;
                            l = h.currentTarget;
                            h = h.listener;
                            if (k !== f && e.isPropagationStopped()) break a;
                            nf(e, h, l);
                            f = k;
                        }
                    }
                }
                if (Qb) throw a = Rb, Qb = false, Rb = null, a;
            }
            function D(a, b) {
                var c = b[of];
                void 0 === c && (c = b[of] = /* @__PURE__ */ new Set());
                var d = a + "__bubble";
                c.has(d) || (pf(b, a, 2, false), c.add(d));
            }
            function qf(a, b, c) {
                var d = 0;
                b && (d |= 4);
                pf(c, a, d, b);
            }
            var rf = "_reactListening" + Math.random().toString(36).slice(2);
            function sf(a) {
                if (!a[rf]) {
                    a[rf] = true;
                    da.forEach(function(b2) {
                        "selectionchange" !== b2 && (mf.has(b2) || qf(b2, false, a), qf(b2, true, a));
                    });
                    var b = 9 === a.nodeType ? a : a.ownerDocument;
                    null === b || b[rf] || (b[rf] = true, qf("selectionchange", false, b));
                }
            }
            function pf(a, b, c, d) {
                switch(jd(b)){
                    case 1:
                        var e = ed;
                        break;
                    case 4:
                        e = gd;
                        break;
                    default:
                        e = fd;
                }
                c = e.bind(null, b, c, a);
                e = void 0;
                !Lb || "touchstart" !== b && "touchmove" !== b && "wheel" !== b || (e = true);
                d ? void 0 !== e ? a.addEventListener(b, c, {
                    capture: true,
                    passive: e
                }) : a.addEventListener(b, c, true) : void 0 !== e ? a.addEventListener(b, c, {
                    passive: e
                }) : a.addEventListener(b, c, false);
            }
            function hd(a, b, c, d, e) {
                var f = d;
                if (0 === (b & 1) && 0 === (b & 2) && null !== d) a: for(;;){
                    if (null === d) return;
                    var g = d.tag;
                    if (3 === g || 4 === g) {
                        var h = d.stateNode.containerInfo;
                        if (h === e || 8 === h.nodeType && h.parentNode === e) break;
                        if (4 === g) for(g = d.return; null !== g;){
                            var k = g.tag;
                            if (3 === k || 4 === k) {
                                if (k = g.stateNode.containerInfo, k === e || 8 === k.nodeType && k.parentNode === e) return;
                            }
                            g = g.return;
                        }
                        for(; null !== h;){
                            g = Wc(h);
                            if (null === g) return;
                            k = g.tag;
                            if (5 === k || 6 === k) {
                                d = f = g;
                                continue a;
                            }
                            h = h.parentNode;
                        }
                    }
                    d = d.return;
                }
                Jb(function() {
                    var d2 = f, e2 = xb(c), g2 = [];
                    a: {
                        var h2 = df.get(a);
                        if (void 0 !== h2) {
                            var k2 = td, n = a;
                            switch(a){
                                case "keypress":
                                    if (0 === od(c)) break a;
                                case "keydown":
                                case "keyup":
                                    k2 = Rd;
                                    break;
                                case "focusin":
                                    n = "focus";
                                    k2 = Fd;
                                    break;
                                case "focusout":
                                    n = "blur";
                                    k2 = Fd;
                                    break;
                                case "beforeblur":
                                case "afterblur":
                                    k2 = Fd;
                                    break;
                                case "click":
                                    if (2 === c.button) break a;
                                case "auxclick":
                                case "dblclick":
                                case "mousedown":
                                case "mousemove":
                                case "mouseup":
                                case "mouseout":
                                case "mouseover":
                                case "contextmenu":
                                    k2 = Bd;
                                    break;
                                case "drag":
                                case "dragend":
                                case "dragenter":
                                case "dragexit":
                                case "dragleave":
                                case "dragover":
                                case "dragstart":
                                case "drop":
                                    k2 = Dd;
                                    break;
                                case "touchcancel":
                                case "touchend":
                                case "touchmove":
                                case "touchstart":
                                    k2 = Vd;
                                    break;
                                case $e:
                                case af:
                                case bf:
                                    k2 = Hd;
                                    break;
                                case cf:
                                    k2 = Xd;
                                    break;
                                case "scroll":
                                    k2 = vd;
                                    break;
                                case "wheel":
                                    k2 = Zd;
                                    break;
                                case "copy":
                                case "cut":
                                case "paste":
                                    k2 = Jd;
                                    break;
                                case "gotpointercapture":
                                case "lostpointercapture":
                                case "pointercancel":
                                case "pointerdown":
                                case "pointermove":
                                case "pointerout":
                                case "pointerover":
                                case "pointerup":
                                    k2 = Td;
                            }
                            var t = 0 !== (b & 4), J = !t && "scroll" === a, x = t ? null !== h2 ? h2 + "Capture" : null : h2;
                            t = [];
                            for(var w = d2, u; null !== w;){
                                u = w;
                                var F = u.stateNode;
                                5 === u.tag && null !== F && (u = F, null !== x && (F = Kb(w, x), null != F && t.push(tf(w, F, u))));
                                if (J) break;
                                w = w.return;
                            }
                            0 < t.length && (h2 = new k2(h2, n, null, c, e2), g2.push({
                                event: h2,
                                listeners: t
                            }));
                        }
                    }
                    if (0 === (b & 7)) {
                        a: {
                            h2 = "mouseover" === a || "pointerover" === a;
                            k2 = "mouseout" === a || "pointerout" === a;
                            if (h2 && c !== wb && (n = c.relatedTarget || c.fromElement) && (Wc(n) || n[uf])) break a;
                            if (k2 || h2) {
                                h2 = e2.window === e2 ? e2 : (h2 = e2.ownerDocument) ? h2.defaultView || h2.parentWindow : window;
                                if (k2) {
                                    if (n = c.relatedTarget || c.toElement, k2 = d2, n = n ? Wc(n) : null, null !== n && (J = Vb(n), n !== J || 5 !== n.tag && 6 !== n.tag)) n = null;
                                } else k2 = null, n = d2;
                                if (k2 !== n) {
                                    t = Bd;
                                    F = "onMouseLeave";
                                    x = "onMouseEnter";
                                    w = "mouse";
                                    if ("pointerout" === a || "pointerover" === a) t = Td, F = "onPointerLeave", x = "onPointerEnter", w = "pointer";
                                    J = null == k2 ? h2 : ue(k2);
                                    u = null == n ? h2 : ue(n);
                                    h2 = new t(F, w + "leave", k2, c, e2);
                                    h2.target = J;
                                    h2.relatedTarget = u;
                                    F = null;
                                    Wc(e2) === d2 && (t = new t(x, w + "enter", n, c, e2), t.target = u, t.relatedTarget = J, F = t);
                                    J = F;
                                    if (k2 && n) b: {
                                        t = k2;
                                        x = n;
                                        w = 0;
                                        for(u = t; u; u = vf(u))w++;
                                        u = 0;
                                        for(F = x; F; F = vf(F))u++;
                                        for(; 0 < w - u;)t = vf(t), w--;
                                        for(; 0 < u - w;)x = vf(x), u--;
                                        for(; w--;){
                                            if (t === x || null !== x && t === x.alternate) break b;
                                            t = vf(t);
                                            x = vf(x);
                                        }
                                        t = null;
                                    }
                                    else t = null;
                                    null !== k2 && wf(g2, h2, k2, t, false);
                                    null !== n && null !== J && wf(g2, J, n, t, true);
                                }
                            }
                        }
                        a: {
                            h2 = d2 ? ue(d2) : window;
                            k2 = h2.nodeName && h2.nodeName.toLowerCase();
                            if ("select" === k2 || "input" === k2 && "file" === h2.type) var na = ve;
                            else if (me(h2)) if (we) na = Fe;
                            else {
                                na = De;
                                var xa = Ce;
                            }
                            else (k2 = h2.nodeName) && "input" === k2.toLowerCase() && ("checkbox" === h2.type || "radio" === h2.type) && (na = Ee);
                            if (na && (na = na(a, d2))) {
                                ne(g2, na, c, e2);
                                break a;
                            }
                            xa && xa(a, h2, d2);
                            "focusout" === a && (xa = h2._wrapperState) && xa.controlled && "number" === h2.type && cb(h2, "number", h2.value);
                        }
                        xa = d2 ? ue(d2) : window;
                        switch(a){
                            case "focusin":
                                if (me(xa) || "true" === xa.contentEditable) Qe = xa, Re = d2, Se = null;
                                break;
                            case "focusout":
                                Se = Re = Qe = null;
                                break;
                            case "mousedown":
                                Te = true;
                                break;
                            case "contextmenu":
                            case "mouseup":
                            case "dragend":
                                Te = false;
                                Ue(g2, c, e2);
                                break;
                            case "selectionchange":
                                if (Pe) break;
                            case "keydown":
                            case "keyup":
                                Ue(g2, c, e2);
                        }
                        var $a;
                        if (ae) b: {
                            switch(a){
                                case "compositionstart":
                                    var ba = "onCompositionStart";
                                    break b;
                                case "compositionend":
                                    ba = "onCompositionEnd";
                                    break b;
                                case "compositionupdate":
                                    ba = "onCompositionUpdate";
                                    break b;
                            }
                            ba = void 0;
                        }
                        else ie ? ge(a, c) && (ba = "onCompositionEnd") : "keydown" === a && 229 === c.keyCode && (ba = "onCompositionStart");
                        ba && (de && "ko" !== c.locale && (ie || "onCompositionStart" !== ba ? "onCompositionEnd" === ba && ie && ($a = nd()) : (kd = e2, ld = "value" in kd ? kd.value : kd.textContent, ie = true)), xa = oe(d2, ba), 0 < xa.length && (ba = new Ld(ba, a, null, c, e2), g2.push({
                            event: ba,
                            listeners: xa
                        }), $a ? ba.data = $a : ($a = he(c), null !== $a && (ba.data = $a))));
                        if ($a = ce ? je(a, c) : ke(a, c)) d2 = oe(d2, "onBeforeInput"), 0 < d2.length && (e2 = new Ld("onBeforeInput", "beforeinput", null, c, e2), g2.push({
                            event: e2,
                            listeners: d2
                        }), e2.data = $a);
                    }
                    se(g2, b);
                });
            }
            function tf(a, b, c) {
                return {
                    instance: a,
                    listener: b,
                    currentTarget: c
                };
            }
            function oe(a, b) {
                for(var c = b + "Capture", d = []; null !== a;){
                    var e = a, f = e.stateNode;
                    5 === e.tag && null !== f && (e = f, f = Kb(a, c), null != f && d.unshift(tf(a, f, e)), f = Kb(a, b), null != f && d.push(tf(a, f, e)));
                    a = a.return;
                }
                return d;
            }
            function vf(a) {
                if (null === a) return null;
                do a = a.return;
                while (a && 5 !== a.tag)
                return a ? a : null;
            }
            function wf(a, b, c, d, e) {
                for(var f = b._reactName, g = []; null !== c && c !== d;){
                    var h = c, k = h.alternate, l = h.stateNode;
                    if (null !== k && k === d) break;
                    5 === h.tag && null !== l && (h = l, e ? (k = Kb(c, f), null != k && g.unshift(tf(c, k, h))) : e || (k = Kb(c, f), null != k && g.push(tf(c, k, h))));
                    c = c.return;
                }
                0 !== g.length && a.push({
                    event: b,
                    listeners: g
                });
            }
            var xf = /\r\n?/g;
            var yf = /\u0000|\uFFFD/g;
            function zf(a) {
                return ("string" === typeof a ? a : "" + a).replace(xf, "\n").replace(yf, "");
            }
            function Af(a, b, c) {
                b = zf(b);
                if (zf(a) !== b && c) throw Error(p(425));
            }
            function Bf() {}
            var Cf = null;
            var Df = null;
            function Ef(a, b) {
                return "textarea" === a || "noscript" === a || "string" === typeof b.children || "number" === typeof b.children || "object" === typeof b.dangerouslySetInnerHTML && null !== b.dangerouslySetInnerHTML && null != b.dangerouslySetInnerHTML.__html;
            }
            var Ff = "function" === typeof setTimeout ? setTimeout : void 0;
            var Gf = "function" === typeof clearTimeout ? clearTimeout : void 0;
            var Hf = "function" === typeof Promise ? Promise : void 0;
            var Jf = "function" === typeof queueMicrotask ? queueMicrotask : "undefined" !== typeof Hf ? function(a) {
                return Hf.resolve(null).then(a).catch(If);
            } : Ff;
            function If(a) {
                setTimeout(function() {
                    throw a;
                });
            }
            function Kf(a, b) {
                var c = b, d = 0;
                do {
                    var e = c.nextSibling;
                    a.removeChild(c);
                    if (e && 8 === e.nodeType) if (c = e.data, "/$" === c) {
                        if (0 === d) {
                            a.removeChild(e);
                            bd(b);
                            return;
                        }
                        d--;
                    } else "$" !== c && "$?" !== c && "$!" !== c || d++;
                    c = e;
                }while (c)
                bd(b);
            }
            function Lf(a) {
                for(; null != a; a = a.nextSibling){
                    var b = a.nodeType;
                    if (1 === b || 3 === b) break;
                    if (8 === b) {
                        b = a.data;
                        if ("$" === b || "$!" === b || "$?" === b) break;
                        if ("/$" === b) return null;
                    }
                }
                return a;
            }
            function Mf(a) {
                a = a.previousSibling;
                for(var b = 0; a;){
                    if (8 === a.nodeType) {
                        var c = a.data;
                        if ("$" === c || "$!" === c || "$?" === c) {
                            if (0 === b) return a;
                            b--;
                        } else "/$" === c && b++;
                    }
                    a = a.previousSibling;
                }
                return null;
            }
            var Nf = Math.random().toString(36).slice(2);
            var Of = "__reactFiber$" + Nf;
            var Pf = "__reactProps$" + Nf;
            var uf = "__reactContainer$" + Nf;
            var of = "__reactEvents$" + Nf;
            var Qf = "__reactListeners$" + Nf;
            var Rf = "__reactHandles$" + Nf;
            function Wc(a) {
                var b = a[Of];
                if (b) return b;
                for(var c = a.parentNode; c;){
                    if (b = c[uf] || c[Of]) {
                        c = b.alternate;
                        if (null !== b.child || null !== c && null !== c.child) for(a = Mf(a); null !== a;){
                            if (c = a[Of]) return c;
                            a = Mf(a);
                        }
                        return b;
                    }
                    a = c;
                    c = a.parentNode;
                }
                return null;
            }
            function Cb(a) {
                a = a[Of] || a[uf];
                return !a || 5 !== a.tag && 6 !== a.tag && 13 !== a.tag && 3 !== a.tag ? null : a;
            }
            function ue(a) {
                if (5 === a.tag || 6 === a.tag) return a.stateNode;
                throw Error(p(33));
            }
            function Db(a) {
                return a[Pf] || null;
            }
            var Sf = [];
            var Tf = -1;
            function Uf(a) {
                return {
                    current: a
                };
            }
            function E(a) {
                0 > Tf || (a.current = Sf[Tf], Sf[Tf] = null, Tf--);
            }
            function G(a, b) {
                Tf++;
                Sf[Tf] = a.current;
                a.current = b;
            }
            var Vf = {};
            var H = Uf(Vf);
            var Wf = Uf(false);
            var Xf = Vf;
            function Yf(a, b) {
                var c = a.type.contextTypes;
                if (!c) return Vf;
                var d = a.stateNode;
                if (d && d.__reactInternalMemoizedUnmaskedChildContext === b) return d.__reactInternalMemoizedMaskedChildContext;
                var e = {}, f;
                for(f in c)e[f] = b[f];
                d && (a = a.stateNode, a.__reactInternalMemoizedUnmaskedChildContext = b, a.__reactInternalMemoizedMaskedChildContext = e);
                return e;
            }
            function Zf(a) {
                a = a.childContextTypes;
                return null !== a && void 0 !== a;
            }
            function $f() {
                E(Wf);
                E(H);
            }
            function ag(a, b, c) {
                if (H.current !== Vf) throw Error(p(168));
                G(H, b);
                G(Wf, c);
            }
            function bg(a, b, c) {
                var d = a.stateNode;
                b = b.childContextTypes;
                if ("function" !== typeof d.getChildContext) return c;
                d = d.getChildContext();
                for(var e in d)if (!(e in b)) throw Error(p(108, Ra(a) || "Unknown", e));
                return A({}, c, d);
            }
            function cg(a) {
                a = (a = a.stateNode) && a.__reactInternalMemoizedMergedChildContext || Vf;
                Xf = H.current;
                G(H, a);
                G(Wf, Wf.current);
                return true;
            }
            function dg(a, b, c) {
                var d = a.stateNode;
                if (!d) throw Error(p(169));
                c ? (a = bg(a, b, Xf), d.__reactInternalMemoizedMergedChildContext = a, E(Wf), E(H), G(H, a)) : E(Wf);
                G(Wf, c);
            }
            var eg = null;
            var fg = false;
            var gg = false;
            function hg(a) {
                null === eg ? eg = [
                    a
                ] : eg.push(a);
            }
            function ig(a) {
                fg = true;
                hg(a);
            }
            function jg() {
                if (!gg && null !== eg) {
                    gg = true;
                    var a = 0, b = C;
                    try {
                        var c = eg;
                        for(C = 1; a < c.length; a++){
                            var d = c[a];
                            do d = d(true);
                            while (null !== d)
                        }
                        eg = null;
                        fg = false;
                    } catch (e) {
                        throw null !== eg && (eg = eg.slice(a + 1)), ac(fc, jg), e;
                    } finally{
                        C = b, gg = false;
                    }
                }
                return null;
            }
            var kg = [];
            var lg = 0;
            var mg = null;
            var ng = 0;
            var og = [];
            var pg = 0;
            var qg = null;
            var rg = 1;
            var sg = "";
            function tg(a, b) {
                kg[lg++] = ng;
                kg[lg++] = mg;
                mg = a;
                ng = b;
            }
            function ug(a, b, c) {
                og[pg++] = rg;
                og[pg++] = sg;
                og[pg++] = qg;
                qg = a;
                var d = rg;
                a = sg;
                var e = 32 - oc(d) - 1;
                d &= ~(1 << e);
                c += 1;
                var f = 32 - oc(b) + e;
                if (30 < f) {
                    var g = e - e % 5;
                    f = (d & (1 << g) - 1).toString(32);
                    d >>= g;
                    e -= g;
                    rg = 1 << 32 - oc(b) + e | c << e | d;
                    sg = f + a;
                } else rg = 1 << f | c << e | d, sg = a;
            }
            function vg(a) {
                null !== a.return && (tg(a, 1), ug(a, 1, 0));
            }
            function wg(a) {
                for(; a === mg;)mg = kg[--lg], kg[lg] = null, ng = kg[--lg], kg[lg] = null;
                for(; a === qg;)qg = og[--pg], og[pg] = null, sg = og[--pg], og[pg] = null, rg = og[--pg], og[pg] = null;
            }
            var xg = null;
            var yg = null;
            var I = false;
            var zg = null;
            function Ag(a, b) {
                var c = Bg(5, null, null, 0);
                c.elementType = "DELETED";
                c.stateNode = b;
                c.return = a;
                b = a.deletions;
                null === b ? (a.deletions = [
                    c
                ], a.flags |= 16) : b.push(c);
            }
            function Cg(a, b) {
                switch(a.tag){
                    case 5:
                        var c = a.type;
                        b = 1 !== b.nodeType || c.toLowerCase() !== b.nodeName.toLowerCase() ? null : b;
                        return null !== b ? (a.stateNode = b, xg = a, yg = Lf(b.firstChild), true) : false;
                    case 6:
                        return b = "" === a.pendingProps || 3 !== b.nodeType ? null : b, null !== b ? (a.stateNode = b, xg = a, yg = null, true) : false;
                    case 13:
                        return b = 8 !== b.nodeType ? null : b, null !== b ? (c = null !== qg ? {
                            id: rg,
                            overflow: sg
                        } : null, a.memoizedState = {
                            dehydrated: b,
                            treeContext: c,
                            retryLane: 1073741824
                        }, c = Bg(18, null, null, 0), c.stateNode = b, c.return = a, a.child = c, xg = a, yg = null, true) : false;
                    default:
                        return false;
                }
            }
            function Dg(a) {
                return 0 !== (a.mode & 1) && 0 === (a.flags & 128);
            }
            function Eg(a) {
                if (I) {
                    var b = yg;
                    if (b) {
                        var c = b;
                        if (!Cg(a, b)) {
                            if (Dg(a)) throw Error(p(418));
                            b = Lf(c.nextSibling);
                            var d = xg;
                            b && Cg(a, b) ? Ag(d, c) : (a.flags = a.flags & -4097 | 2, I = false, xg = a);
                        }
                    } else {
                        if (Dg(a)) throw Error(p(418));
                        a.flags = a.flags & -4097 | 2;
                        I = false;
                        xg = a;
                    }
                }
            }
            function Fg(a) {
                for(a = a.return; null !== a && 5 !== a.tag && 3 !== a.tag && 13 !== a.tag;)a = a.return;
                xg = a;
            }
            function Gg(a) {
                if (a !== xg) return false;
                if (!I) return Fg(a), I = true, false;
                var b;
                (b = 3 !== a.tag) && !(b = 5 !== a.tag) && (b = a.type, b = "head" !== b && "body" !== b && !Ef(a.type, a.memoizedProps));
                if (b && (b = yg)) {
                    if (Dg(a)) throw Hg(), Error(p(418));
                    for(; b;)Ag(a, b), b = Lf(b.nextSibling);
                }
                Fg(a);
                if (13 === a.tag) {
                    a = a.memoizedState;
                    a = null !== a ? a.dehydrated : null;
                    if (!a) throw Error(p(317));
                    a: {
                        a = a.nextSibling;
                        for(b = 0; a;){
                            if (8 === a.nodeType) {
                                var c = a.data;
                                if ("/$" === c) {
                                    if (0 === b) {
                                        yg = Lf(a.nextSibling);
                                        break a;
                                    }
                                    b--;
                                } else "$" !== c && "$!" !== c && "$?" !== c || b++;
                            }
                            a = a.nextSibling;
                        }
                        yg = null;
                    }
                } else yg = xg ? Lf(a.stateNode.nextSibling) : null;
                return true;
            }
            function Hg() {
                for(var a = yg; a;)a = Lf(a.nextSibling);
            }
            function Ig() {
                yg = xg = null;
                I = false;
            }
            function Jg(a) {
                null === zg ? zg = [
                    a
                ] : zg.push(a);
            }
            var Kg = ua.ReactCurrentBatchConfig;
            function Lg(a, b) {
                if (a && a.defaultProps) {
                    b = A({}, b);
                    a = a.defaultProps;
                    for(var c in a)void 0 === b[c] && (b[c] = a[c]);
                    return b;
                }
                return b;
            }
            var Mg = Uf(null);
            var Ng = null;
            var Og = null;
            var Pg = null;
            function Qg() {
                Pg = Og = Ng = null;
            }
            function Rg(a) {
                var b = Mg.current;
                E(Mg);
                a._currentValue = b;
            }
            function Sg(a, b, c) {
                for(; null !== a;){
                    var d = a.alternate;
                    (a.childLanes & b) !== b ? (a.childLanes |= b, null !== d && (d.childLanes |= b)) : null !== d && (d.childLanes & b) !== b && (d.childLanes |= b);
                    if (a === c) break;
                    a = a.return;
                }
            }
            function Tg(a, b) {
                Ng = a;
                Pg = Og = null;
                a = a.dependencies;
                null !== a && null !== a.firstContext && (0 !== (a.lanes & b) && (Ug = true), a.firstContext = null);
            }
            function Vg(a) {
                var b = a._currentValue;
                if (Pg !== a) if (a = {
                    context: a,
                    memoizedValue: b,
                    next: null
                }, null === Og) {
                    if (null === Ng) throw Error(p(308));
                    Og = a;
                    Ng.dependencies = {
                        lanes: 0,
                        firstContext: a
                    };
                } else Og = Og.next = a;
                return b;
            }
            var Wg = null;
            function Xg(a) {
                null === Wg ? Wg = [
                    a
                ] : Wg.push(a);
            }
            function Yg(a, b, c, d) {
                var e = b.interleaved;
                null === e ? (c.next = c, Xg(b)) : (c.next = e.next, e.next = c);
                b.interleaved = c;
                return Zg(a, d);
            }
            function Zg(a, b) {
                a.lanes |= b;
                var c = a.alternate;
                null !== c && (c.lanes |= b);
                c = a;
                for(a = a.return; null !== a;)a.childLanes |= b, c = a.alternate, null !== c && (c.childLanes |= b), c = a, a = a.return;
                return 3 === c.tag ? c.stateNode : null;
            }
            var $g = false;
            function ah(a) {
                a.updateQueue = {
                    baseState: a.memoizedState,
                    firstBaseUpdate: null,
                    lastBaseUpdate: null,
                    shared: {
                        pending: null,
                        interleaved: null,
                        lanes: 0
                    },
                    effects: null
                };
            }
            function bh(a, b) {
                a = a.updateQueue;
                b.updateQueue === a && (b.updateQueue = {
                    baseState: a.baseState,
                    firstBaseUpdate: a.firstBaseUpdate,
                    lastBaseUpdate: a.lastBaseUpdate,
                    shared: a.shared,
                    effects: a.effects
                });
            }
            function ch(a, b) {
                return {
                    eventTime: a,
                    lane: b,
                    tag: 0,
                    payload: null,
                    callback: null,
                    next: null
                };
            }
            function dh(a, b, c) {
                var d = a.updateQueue;
                if (null === d) return null;
                d = d.shared;
                if (0 !== (K & 2)) {
                    var e = d.pending;
                    null === e ? b.next = b : (b.next = e.next, e.next = b);
                    d.pending = b;
                    return Zg(a, c);
                }
                e = d.interleaved;
                null === e ? (b.next = b, Xg(d)) : (b.next = e.next, e.next = b);
                d.interleaved = b;
                return Zg(a, c);
            }
            function eh(a, b, c) {
                b = b.updateQueue;
                if (null !== b && (b = b.shared, 0 !== (c & 4194240))) {
                    var d = b.lanes;
                    d &= a.pendingLanes;
                    c |= d;
                    b.lanes = c;
                    Cc(a, c);
                }
            }
            function fh(a, b) {
                var c = a.updateQueue, d = a.alternate;
                if (null !== d && (d = d.updateQueue, c === d)) {
                    var e = null, f = null;
                    c = c.firstBaseUpdate;
                    if (null !== c) {
                        do {
                            var g = {
                                eventTime: c.eventTime,
                                lane: c.lane,
                                tag: c.tag,
                                payload: c.payload,
                                callback: c.callback,
                                next: null
                            };
                            null === f ? e = f = g : f = f.next = g;
                            c = c.next;
                        }while (null !== c)
                        null === f ? e = f = b : f = f.next = b;
                    } else e = f = b;
                    c = {
                        baseState: d.baseState,
                        firstBaseUpdate: e,
                        lastBaseUpdate: f,
                        shared: d.shared,
                        effects: d.effects
                    };
                    a.updateQueue = c;
                    return;
                }
                a = c.lastBaseUpdate;
                null === a ? c.firstBaseUpdate = b : a.next = b;
                c.lastBaseUpdate = b;
            }
            function gh(a, b, c, d) {
                var e = a.updateQueue;
                $g = false;
                var f = e.firstBaseUpdate, g = e.lastBaseUpdate, h = e.shared.pending;
                if (null !== h) {
                    e.shared.pending = null;
                    var k = h, l = k.next;
                    k.next = null;
                    null === g ? f = l : g.next = l;
                    g = k;
                    var m = a.alternate;
                    null !== m && (m = m.updateQueue, h = m.lastBaseUpdate, h !== g && (null === h ? m.firstBaseUpdate = l : h.next = l, m.lastBaseUpdate = k));
                }
                if (null !== f) {
                    var q = e.baseState;
                    g = 0;
                    m = l = k = null;
                    h = f;
                    do {
                        var r = h.lane, y = h.eventTime;
                        if ((d & r) === r) {
                            null !== m && (m = m.next = {
                                eventTime: y,
                                lane: 0,
                                tag: h.tag,
                                payload: h.payload,
                                callback: h.callback,
                                next: null
                            });
                            a: {
                                var n = a, t = h;
                                r = b;
                                y = c;
                                switch(t.tag){
                                    case 1:
                                        n = t.payload;
                                        if ("function" === typeof n) {
                                            q = n.call(y, q, r);
                                            break a;
                                        }
                                        q = n;
                                        break a;
                                    case 3:
                                        n.flags = n.flags & -65537 | 128;
                                    case 0:
                                        n = t.payload;
                                        r = "function" === typeof n ? n.call(y, q, r) : n;
                                        if (null === r || void 0 === r) break a;
                                        q = A({}, q, r);
                                        break a;
                                    case 2:
                                        $g = true;
                                }
                            }
                            null !== h.callback && 0 !== h.lane && (a.flags |= 64, r = e.effects, null === r ? e.effects = [
                                h
                            ] : r.push(h));
                        } else y = {
                            eventTime: y,
                            lane: r,
                            tag: h.tag,
                            payload: h.payload,
                            callback: h.callback,
                            next: null
                        }, null === m ? (l = m = y, k = q) : m = m.next = y, g |= r;
                        h = h.next;
                        if (null === h) if (h = e.shared.pending, null === h) break;
                        else r = h, h = r.next, r.next = null, e.lastBaseUpdate = r, e.shared.pending = null;
                    }while (1)
                    null === m && (k = q);
                    e.baseState = k;
                    e.firstBaseUpdate = l;
                    e.lastBaseUpdate = m;
                    b = e.shared.interleaved;
                    if (null !== b) {
                        e = b;
                        do g |= e.lane, e = e.next;
                        while (e !== b)
                    } else null === f && (e.shared.lanes = 0);
                    hh |= g;
                    a.lanes = g;
                    a.memoizedState = q;
                }
            }
            function ih(a, b, c) {
                a = b.effects;
                b.effects = null;
                if (null !== a) for(b = 0; b < a.length; b++){
                    var d = a[b], e = d.callback;
                    if (null !== e) {
                        d.callback = null;
                        d = c;
                        if ("function" !== typeof e) throw Error(p(191, e));
                        e.call(d);
                    }
                }
            }
            var jh = new aa.Component().refs;
            function kh(a, b, c, d) {
                b = a.memoizedState;
                c = c(d, b);
                c = null === c || void 0 === c ? b : A({}, b, c);
                a.memoizedState = c;
                0 === a.lanes && (a.updateQueue.baseState = c);
            }
            var nh = {
                isMounted: function(a) {
                    return (a = a._reactInternals) ? Vb(a) === a : false;
                },
                enqueueSetState: function(a, b, c) {
                    a = a._reactInternals;
                    var d = L(), e = lh(a), f = ch(d, e);
                    f.payload = b;
                    void 0 !== c && null !== c && (f.callback = c);
                    b = dh(a, f, e);
                    null !== b && (mh(b, a, e, d), eh(b, a, e));
                },
                enqueueReplaceState: function(a, b, c) {
                    a = a._reactInternals;
                    var d = L(), e = lh(a), f = ch(d, e);
                    f.tag = 1;
                    f.payload = b;
                    void 0 !== c && null !== c && (f.callback = c);
                    b = dh(a, f, e);
                    null !== b && (mh(b, a, e, d), eh(b, a, e));
                },
                enqueueForceUpdate: function(a, b) {
                    a = a._reactInternals;
                    var c = L(), d = lh(a), e = ch(c, d);
                    e.tag = 2;
                    void 0 !== b && null !== b && (e.callback = b);
                    b = dh(a, e, d);
                    null !== b && (mh(b, a, d, c), eh(b, a, d));
                }
            };
            function oh(a, b, c, d, e, f, g) {
                a = a.stateNode;
                return "function" === typeof a.shouldComponentUpdate ? a.shouldComponentUpdate(d, f, g) : b.prototype && b.prototype.isPureReactComponent ? !Ie(c, d) || !Ie(e, f) : true;
            }
            function ph(a, b, c) {
                var d = false, e = Vf;
                var f = b.contextType;
                "object" === typeof f && null !== f ? f = Vg(f) : (e = Zf(b) ? Xf : H.current, d = b.contextTypes, f = (d = null !== d && void 0 !== d) ? Yf(a, e) : Vf);
                b = new b(c, f);
                a.memoizedState = null !== b.state && void 0 !== b.state ? b.state : null;
                b.updater = nh;
                a.stateNode = b;
                b._reactInternals = a;
                d && (a = a.stateNode, a.__reactInternalMemoizedUnmaskedChildContext = e, a.__reactInternalMemoizedMaskedChildContext = f);
                return b;
            }
            function qh(a, b, c, d) {
                a = b.state;
                "function" === typeof b.componentWillReceiveProps && b.componentWillReceiveProps(c, d);
                "function" === typeof b.UNSAFE_componentWillReceiveProps && b.UNSAFE_componentWillReceiveProps(c, d);
                b.state !== a && nh.enqueueReplaceState(b, b.state, null);
            }
            function rh(a, b, c, d) {
                var e = a.stateNode;
                e.props = c;
                e.state = a.memoizedState;
                e.refs = jh;
                ah(a);
                var f = b.contextType;
                "object" === typeof f && null !== f ? e.context = Vg(f) : (f = Zf(b) ? Xf : H.current, e.context = Yf(a, f));
                e.state = a.memoizedState;
                f = b.getDerivedStateFromProps;
                "function" === typeof f && (kh(a, b, f, c), e.state = a.memoizedState);
                "function" === typeof b.getDerivedStateFromProps || "function" === typeof e.getSnapshotBeforeUpdate || "function" !== typeof e.UNSAFE_componentWillMount && "function" !== typeof e.componentWillMount || (b = e.state, "function" === typeof e.componentWillMount && e.componentWillMount(), "function" === typeof e.UNSAFE_componentWillMount && e.UNSAFE_componentWillMount(), b !== e.state && nh.enqueueReplaceState(e, e.state, null), gh(a, c, e, d), e.state = a.memoizedState);
                "function" === typeof e.componentDidMount && (a.flags |= 4194308);
            }
            function sh(a, b, c) {
                a = c.ref;
                if (null !== a && "function" !== typeof a && "object" !== typeof a) {
                    if (c._owner) {
                        c = c._owner;
                        if (c) {
                            if (1 !== c.tag) throw Error(p(309));
                            var d = c.stateNode;
                        }
                        if (!d) throw Error(p(147, a));
                        var e = d, f = "" + a;
                        if (null !== b && null !== b.ref && "function" === typeof b.ref && b.ref._stringRef === f) return b.ref;
                        b = function(a2) {
                            var b2 = e.refs;
                            b2 === jh && (b2 = e.refs = {});
                            null === a2 ? delete b2[f] : b2[f] = a2;
                        };
                        b._stringRef = f;
                        return b;
                    }
                    if ("string" !== typeof a) throw Error(p(284));
                    if (!c._owner) throw Error(p(290, a));
                }
                return a;
            }
            function th(a, b) {
                a = Object.prototype.toString.call(b);
                throw Error(p(31, "[object Object]" === a ? "object with keys {" + Object.keys(b).join(", ") + "}" : a));
            }
            function uh(a) {
                var b = a._init;
                return b(a._payload);
            }
            function vh(a) {
                function b(b2, c2) {
                    if (a) {
                        var d2 = b2.deletions;
                        null === d2 ? (b2.deletions = [
                            c2
                        ], b2.flags |= 16) : d2.push(c2);
                    }
                }
                function c(c2, d2) {
                    if (!a) return null;
                    for(; null !== d2;)b(c2, d2), d2 = d2.sibling;
                    return null;
                }
                function d(a2, b2) {
                    for(a2 = /* @__PURE__ */ new Map(); null !== b2;)null !== b2.key ? a2.set(b2.key, b2) : a2.set(b2.index, b2), b2 = b2.sibling;
                    return a2;
                }
                function e(a2, b2) {
                    a2 = wh(a2, b2);
                    a2.index = 0;
                    a2.sibling = null;
                    return a2;
                }
                function f(b2, c2, d2) {
                    b2.index = d2;
                    if (!a) return b2.flags |= 1048576, c2;
                    d2 = b2.alternate;
                    if (null !== d2) return d2 = d2.index, d2 < c2 ? (b2.flags |= 2, c2) : d2;
                    b2.flags |= 2;
                    return c2;
                }
                function g(b2) {
                    a && null === b2.alternate && (b2.flags |= 2);
                    return b2;
                }
                function h(a2, b2, c2, d2) {
                    if (null === b2 || 6 !== b2.tag) return b2 = xh(c2, a2.mode, d2), b2.return = a2, b2;
                    b2 = e(b2, c2);
                    b2.return = a2;
                    return b2;
                }
                function k(a2, b2, c2, d2) {
                    var f2 = c2.type;
                    if (f2 === ya) return m(a2, b2, c2.props.children, d2, c2.key);
                    if (null !== b2 && (b2.elementType === f2 || "object" === typeof f2 && null !== f2 && f2.$$typeof === Ha && uh(f2) === b2.type)) return d2 = e(b2, c2.props), d2.ref = sh(a2, b2, c2), d2.return = a2, d2;
                    d2 = yh(c2.type, c2.key, c2.props, null, a2.mode, d2);
                    d2.ref = sh(a2, b2, c2);
                    d2.return = a2;
                    return d2;
                }
                function l(a2, b2, c2, d2) {
                    if (null === b2 || 4 !== b2.tag || b2.stateNode.containerInfo !== c2.containerInfo || b2.stateNode.implementation !== c2.implementation) return b2 = zh(c2, a2.mode, d2), b2.return = a2, b2;
                    b2 = e(b2, c2.children || []);
                    b2.return = a2;
                    return b2;
                }
                function m(a2, b2, c2, d2, f2) {
                    if (null === b2 || 7 !== b2.tag) return b2 = Ah(c2, a2.mode, d2, f2), b2.return = a2, b2;
                    b2 = e(b2, c2);
                    b2.return = a2;
                    return b2;
                }
                function q(a2, b2, c2) {
                    if ("string" === typeof b2 && "" !== b2 || "number" === typeof b2) return b2 = xh("" + b2, a2.mode, c2), b2.return = a2, b2;
                    if ("object" === typeof b2 && null !== b2) {
                        switch(b2.$$typeof){
                            case va:
                                return c2 = yh(b2.type, b2.key, b2.props, null, a2.mode, c2), c2.ref = sh(a2, null, b2), c2.return = a2, c2;
                            case wa:
                                return b2 = zh(b2, a2.mode, c2), b2.return = a2, b2;
                            case Ha:
                                var d2 = b2._init;
                                return q(a2, d2(b2._payload), c2);
                        }
                        if (eb(b2) || Ka(b2)) return b2 = Ah(b2, a2.mode, c2, null), b2.return = a2, b2;
                        th(a2, b2);
                    }
                    return null;
                }
                function r(a2, b2, c2, d2) {
                    var e2 = null !== b2 ? b2.key : null;
                    if ("string" === typeof c2 && "" !== c2 || "number" === typeof c2) return null !== e2 ? null : h(a2, b2, "" + c2, d2);
                    if ("object" === typeof c2 && null !== c2) {
                        switch(c2.$$typeof){
                            case va:
                                return c2.key === e2 ? k(a2, b2, c2, d2) : null;
                            case wa:
                                return c2.key === e2 ? l(a2, b2, c2, d2) : null;
                            case Ha:
                                return e2 = c2._init, r(a2, b2, e2(c2._payload), d2);
                        }
                        if (eb(c2) || Ka(c2)) return null !== e2 ? null : m(a2, b2, c2, d2, null);
                        th(a2, c2);
                    }
                    return null;
                }
                function y(a2, b2, c2, d2, e2) {
                    if ("string" === typeof d2 && "" !== d2 || "number" === typeof d2) return a2 = a2.get(c2) || null, h(b2, a2, "" + d2, e2);
                    if ("object" === typeof d2 && null !== d2) {
                        switch(d2.$$typeof){
                            case va:
                                return a2 = a2.get(null === d2.key ? c2 : d2.key) || null, k(b2, a2, d2, e2);
                            case wa:
                                return a2 = a2.get(null === d2.key ? c2 : d2.key) || null, l(b2, a2, d2, e2);
                            case Ha:
                                var f2 = d2._init;
                                return y(a2, b2, c2, f2(d2._payload), e2);
                        }
                        if (eb(d2) || Ka(d2)) return a2 = a2.get(c2) || null, m(b2, a2, d2, e2, null);
                        th(b2, d2);
                    }
                    return null;
                }
                function n(e2, g2, h2, k2) {
                    for(var l2 = null, m2 = null, u = g2, w = g2 = 0, x = null; null !== u && w < h2.length; w++){
                        u.index > w ? (x = u, u = null) : x = u.sibling;
                        var n2 = r(e2, u, h2[w], k2);
                        if (null === n2) {
                            null === u && (u = x);
                            break;
                        }
                        a && u && null === n2.alternate && b(e2, u);
                        g2 = f(n2, g2, w);
                        null === m2 ? l2 = n2 : m2.sibling = n2;
                        m2 = n2;
                        u = x;
                    }
                    if (w === h2.length) return c(e2, u), I && tg(e2, w), l2;
                    if (null === u) {
                        for(; w < h2.length; w++)u = q(e2, h2[w], k2), null !== u && (g2 = f(u, g2, w), null === m2 ? l2 = u : m2.sibling = u, m2 = u);
                        I && tg(e2, w);
                        return l2;
                    }
                    for(u = d(e2, u); w < h2.length; w++)x = y(u, e2, w, h2[w], k2), null !== x && (a && null !== x.alternate && u.delete(null === x.key ? w : x.key), g2 = f(x, g2, w), null === m2 ? l2 = x : m2.sibling = x, m2 = x);
                    a && u.forEach(function(a2) {
                        return b(e2, a2);
                    });
                    I && tg(e2, w);
                    return l2;
                }
                function t(e2, g2, h2, k2) {
                    var l2 = Ka(h2);
                    if ("function" !== typeof l2) throw Error(p(150));
                    h2 = l2.call(h2);
                    if (null == h2) throw Error(p(151));
                    for(var u = l2 = null, m2 = g2, w = g2 = 0, x = null, n2 = h2.next(); null !== m2 && !n2.done; w++, n2 = h2.next()){
                        m2.index > w ? (x = m2, m2 = null) : x = m2.sibling;
                        var t2 = r(e2, m2, n2.value, k2);
                        if (null === t2) {
                            null === m2 && (m2 = x);
                            break;
                        }
                        a && m2 && null === t2.alternate && b(e2, m2);
                        g2 = f(t2, g2, w);
                        null === u ? l2 = t2 : u.sibling = t2;
                        u = t2;
                        m2 = x;
                    }
                    if (n2.done) return c(e2, m2), I && tg(e2, w), l2;
                    if (null === m2) {
                        for(; !n2.done; w++, n2 = h2.next())n2 = q(e2, n2.value, k2), null !== n2 && (g2 = f(n2, g2, w), null === u ? l2 = n2 : u.sibling = n2, u = n2);
                        I && tg(e2, w);
                        return l2;
                    }
                    for(m2 = d(e2, m2); !n2.done; w++, n2 = h2.next())n2 = y(m2, e2, w, n2.value, k2), null !== n2 && (a && null !== n2.alternate && m2.delete(null === n2.key ? w : n2.key), g2 = f(n2, g2, w), null === u ? l2 = n2 : u.sibling = n2, u = n2);
                    a && m2.forEach(function(a2) {
                        return b(e2, a2);
                    });
                    I && tg(e2, w);
                    return l2;
                }
                function J(a2, d2, f2, h2) {
                    "object" === typeof f2 && null !== f2 && f2.type === ya && null === f2.key && (f2 = f2.props.children);
                    if ("object" === typeof f2 && null !== f2) {
                        switch(f2.$$typeof){
                            case va:
                                a: {
                                    for(var k2 = f2.key, l2 = d2; null !== l2;){
                                        if (l2.key === k2) {
                                            k2 = f2.type;
                                            if (k2 === ya) {
                                                if (7 === l2.tag) {
                                                    c(a2, l2.sibling);
                                                    d2 = e(l2, f2.props.children);
                                                    d2.return = a2;
                                                    a2 = d2;
                                                    break a;
                                                }
                                            } else if (l2.elementType === k2 || "object" === typeof k2 && null !== k2 && k2.$$typeof === Ha && uh(k2) === l2.type) {
                                                c(a2, l2.sibling);
                                                d2 = e(l2, f2.props);
                                                d2.ref = sh(a2, l2, f2);
                                                d2.return = a2;
                                                a2 = d2;
                                                break a;
                                            }
                                            c(a2, l2);
                                            break;
                                        } else b(a2, l2);
                                        l2 = l2.sibling;
                                    }
                                    f2.type === ya ? (d2 = Ah(f2.props.children, a2.mode, h2, f2.key), d2.return = a2, a2 = d2) : (h2 = yh(f2.type, f2.key, f2.props, null, a2.mode, h2), h2.ref = sh(a2, d2, f2), h2.return = a2, a2 = h2);
                                }
                                return g(a2);
                            case wa:
                                a: {
                                    for(l2 = f2.key; null !== d2;){
                                        if (d2.key === l2) if (4 === d2.tag && d2.stateNode.containerInfo === f2.containerInfo && d2.stateNode.implementation === f2.implementation) {
                                            c(a2, d2.sibling);
                                            d2 = e(d2, f2.children || []);
                                            d2.return = a2;
                                            a2 = d2;
                                            break a;
                                        } else {
                                            c(a2, d2);
                                            break;
                                        }
                                        else b(a2, d2);
                                        d2 = d2.sibling;
                                    }
                                    d2 = zh(f2, a2.mode, h2);
                                    d2.return = a2;
                                    a2 = d2;
                                }
                                return g(a2);
                            case Ha:
                                return l2 = f2._init, J(a2, d2, l2(f2._payload), h2);
                        }
                        if (eb(f2)) return n(a2, d2, f2, h2);
                        if (Ka(f2)) return t(a2, d2, f2, h2);
                        th(a2, f2);
                    }
                    return "string" === typeof f2 && "" !== f2 || "number" === typeof f2 ? (f2 = "" + f2, null !== d2 && 6 === d2.tag ? (c(a2, d2.sibling), d2 = e(d2, f2), d2.return = a2, a2 = d2) : (c(a2, d2), d2 = xh(f2, a2.mode, h2), d2.return = a2, a2 = d2), g(a2)) : c(a2, d2);
                }
                return J;
            }
            var Bh = vh(true);
            var Ch = vh(false);
            var Dh = {};
            var Eh = Uf(Dh);
            var Fh = Uf(Dh);
            var Gh = Uf(Dh);
            function Hh(a) {
                if (a === Dh) throw Error(p(174));
                return a;
            }
            function Ih(a, b) {
                G(Gh, b);
                G(Fh, a);
                G(Eh, Dh);
                a = b.nodeType;
                switch(a){
                    case 9:
                    case 11:
                        b = (b = b.documentElement) ? b.namespaceURI : lb(null, "");
                        break;
                    default:
                        a = 8 === a ? b.parentNode : b, b = a.namespaceURI || null, a = a.tagName, b = lb(b, a);
                }
                E(Eh);
                G(Eh, b);
            }
            function Jh() {
                E(Eh);
                E(Fh);
                E(Gh);
            }
            function Kh(a) {
                Hh(Gh.current);
                var b = Hh(Eh.current);
                var c = lb(b, a.type);
                b !== c && (G(Fh, a), G(Eh, c));
            }
            function Lh(a) {
                Fh.current === a && (E(Eh), E(Fh));
            }
            var M = Uf(0);
            function Mh(a) {
                for(var b = a; null !== b;){
                    if (13 === b.tag) {
                        var c = b.memoizedState;
                        if (null !== c && (c = c.dehydrated, null === c || "$?" === c.data || "$!" === c.data)) return b;
                    } else if (19 === b.tag && void 0 !== b.memoizedProps.revealOrder) {
                        if (0 !== (b.flags & 128)) return b;
                    } else if (null !== b.child) {
                        b.child.return = b;
                        b = b.child;
                        continue;
                    }
                    if (b === a) break;
                    for(; null === b.sibling;){
                        if (null === b.return || b.return === a) return null;
                        b = b.return;
                    }
                    b.sibling.return = b.return;
                    b = b.sibling;
                }
                return null;
            }
            var Nh = [];
            function Oh() {
                for(var a = 0; a < Nh.length; a++)Nh[a]._workInProgressVersionPrimary = null;
                Nh.length = 0;
            }
            var Ph = ua.ReactCurrentDispatcher;
            var Qh = ua.ReactCurrentBatchConfig;
            var Rh = 0;
            var N = null;
            var O = null;
            var P = null;
            var Sh = false;
            var Th = false;
            var Uh = 0;
            var Vh = 0;
            function Q() {
                throw Error(p(321));
            }
            function Wh(a, b) {
                if (null === b) return false;
                for(var c = 0; c < b.length && c < a.length; c++)if (!He(a[c], b[c])) return false;
                return true;
            }
            function Xh(a, b, c, d, e, f) {
                Rh = f;
                N = b;
                b.memoizedState = null;
                b.updateQueue = null;
                b.lanes = 0;
                Ph.current = null === a || null === a.memoizedState ? Yh : Zh;
                a = c(d, e);
                if (Th) {
                    f = 0;
                    do {
                        Th = false;
                        Uh = 0;
                        if (25 <= f) throw Error(p(301));
                        f += 1;
                        P = O = null;
                        b.updateQueue = null;
                        Ph.current = $h;
                        a = c(d, e);
                    }while (Th)
                }
                Ph.current = ai;
                b = null !== O && null !== O.next;
                Rh = 0;
                P = O = N = null;
                Sh = false;
                if (b) throw Error(p(300));
                return a;
            }
            function bi() {
                var a = 0 !== Uh;
                Uh = 0;
                return a;
            }
            function ci() {
                var a = {
                    memoizedState: null,
                    baseState: null,
                    baseQueue: null,
                    queue: null,
                    next: null
                };
                null === P ? N.memoizedState = P = a : P = P.next = a;
                return P;
            }
            function di() {
                if (null === O) {
                    var a = N.alternate;
                    a = null !== a ? a.memoizedState : null;
                } else a = O.next;
                var b = null === P ? N.memoizedState : P.next;
                if (null !== b) P = b, O = a;
                else {
                    if (null === a) throw Error(p(310));
                    O = a;
                    a = {
                        memoizedState: O.memoizedState,
                        baseState: O.baseState,
                        baseQueue: O.baseQueue,
                        queue: O.queue,
                        next: null
                    };
                    null === P ? N.memoizedState = P = a : P = P.next = a;
                }
                return P;
            }
            function ei(a, b) {
                return "function" === typeof b ? b(a) : b;
            }
            function fi(a) {
                var b = di(), c = b.queue;
                if (null === c) throw Error(p(311));
                c.lastRenderedReducer = a;
                var d = O, e = d.baseQueue, f = c.pending;
                if (null !== f) {
                    if (null !== e) {
                        var g = e.next;
                        e.next = f.next;
                        f.next = g;
                    }
                    d.baseQueue = e = f;
                    c.pending = null;
                }
                if (null !== e) {
                    f = e.next;
                    d = d.baseState;
                    var h = g = null, k = null, l = f;
                    do {
                        var m = l.lane;
                        if ((Rh & m) === m) null !== k && (k = k.next = {
                            lane: 0,
                            action: l.action,
                            hasEagerState: l.hasEagerState,
                            eagerState: l.eagerState,
                            next: null
                        }), d = l.hasEagerState ? l.eagerState : a(d, l.action);
                        else {
                            var q = {
                                lane: m,
                                action: l.action,
                                hasEagerState: l.hasEagerState,
                                eagerState: l.eagerState,
                                next: null
                            };
                            null === k ? (h = k = q, g = d) : k = k.next = q;
                            N.lanes |= m;
                            hh |= m;
                        }
                        l = l.next;
                    }while (null !== l && l !== f)
                    null === k ? g = d : k.next = h;
                    He(d, b.memoizedState) || (Ug = true);
                    b.memoizedState = d;
                    b.baseState = g;
                    b.baseQueue = k;
                    c.lastRenderedState = d;
                }
                a = c.interleaved;
                if (null !== a) {
                    e = a;
                    do f = e.lane, N.lanes |= f, hh |= f, e = e.next;
                    while (e !== a)
                } else null === e && (c.lanes = 0);
                return [
                    b.memoizedState,
                    c.dispatch
                ];
            }
            function gi(a) {
                var b = di(), c = b.queue;
                if (null === c) throw Error(p(311));
                c.lastRenderedReducer = a;
                var d = c.dispatch, e = c.pending, f = b.memoizedState;
                if (null !== e) {
                    c.pending = null;
                    var g = e = e.next;
                    do f = a(f, g.action), g = g.next;
                    while (g !== e)
                    He(f, b.memoizedState) || (Ug = true);
                    b.memoizedState = f;
                    null === b.baseQueue && (b.baseState = f);
                    c.lastRenderedState = f;
                }
                return [
                    f,
                    d
                ];
            }
            function hi() {}
            function ii(a, b) {
                var c = N, d = di(), e = b(), f = !He(d.memoizedState, e);
                f && (d.memoizedState = e, Ug = true);
                d = d.queue;
                ji(ki.bind(null, c, d, a), [
                    a
                ]);
                if (d.getSnapshot !== b || f || null !== P && P.memoizedState.tag & 1) {
                    c.flags |= 2048;
                    li(9, mi.bind(null, c, d, e, b), void 0, null);
                    if (null === R) throw Error(p(349));
                    0 !== (Rh & 30) || ni(c, b, e);
                }
                return e;
            }
            function ni(a, b, c) {
                a.flags |= 16384;
                a = {
                    getSnapshot: b,
                    value: c
                };
                b = N.updateQueue;
                null === b ? (b = {
                    lastEffect: null,
                    stores: null
                }, N.updateQueue = b, b.stores = [
                    a
                ]) : (c = b.stores, null === c ? b.stores = [
                    a
                ] : c.push(a));
            }
            function mi(a, b, c, d) {
                b.value = c;
                b.getSnapshot = d;
                oi(b) && pi(a);
            }
            function ki(a, b, c) {
                return c(function() {
                    oi(b) && pi(a);
                });
            }
            function oi(a) {
                var b = a.getSnapshot;
                a = a.value;
                try {
                    var c = b();
                    return !He(a, c);
                } catch (d) {
                    return true;
                }
            }
            function pi(a) {
                var b = Zg(a, 1);
                null !== b && mh(b, a, 1, -1);
            }
            function qi(a) {
                var b = ci();
                "function" === typeof a && (a = a());
                b.memoizedState = b.baseState = a;
                a = {
                    pending: null,
                    interleaved: null,
                    lanes: 0,
                    dispatch: null,
                    lastRenderedReducer: ei,
                    lastRenderedState: a
                };
                b.queue = a;
                a = a.dispatch = ri.bind(null, N, a);
                return [
                    b.memoizedState,
                    a
                ];
            }
            function li(a, b, c, d) {
                a = {
                    tag: a,
                    create: b,
                    destroy: c,
                    deps: d,
                    next: null
                };
                b = N.updateQueue;
                null === b ? (b = {
                    lastEffect: null,
                    stores: null
                }, N.updateQueue = b, b.lastEffect = a.next = a) : (c = b.lastEffect, null === c ? b.lastEffect = a.next = a : (d = c.next, c.next = a, a.next = d, b.lastEffect = a));
                return a;
            }
            function si() {
                return di().memoizedState;
            }
            function ti(a, b, c, d) {
                var e = ci();
                N.flags |= a;
                e.memoizedState = li(1 | b, c, void 0, void 0 === d ? null : d);
            }
            function ui(a, b, c, d) {
                var e = di();
                d = void 0 === d ? null : d;
                var f = void 0;
                if (null !== O) {
                    var g = O.memoizedState;
                    f = g.destroy;
                    if (null !== d && Wh(d, g.deps)) {
                        e.memoizedState = li(b, c, f, d);
                        return;
                    }
                }
                N.flags |= a;
                e.memoizedState = li(1 | b, c, f, d);
            }
            function vi(a, b) {
                return ti(8390656, 8, a, b);
            }
            function ji(a, b) {
                return ui(2048, 8, a, b);
            }
            function wi(a, b) {
                return ui(4, 2, a, b);
            }
            function xi(a, b) {
                return ui(4, 4, a, b);
            }
            function yi(a, b) {
                if ("function" === typeof b) return a = a(), b(a), function() {
                    b(null);
                };
                if (null !== b && void 0 !== b) return a = a(), b.current = a, function() {
                    b.current = null;
                };
            }
            function zi(a, b, c) {
                c = null !== c && void 0 !== c ? c.concat([
                    a
                ]) : null;
                return ui(4, 4, yi.bind(null, b, a), c);
            }
            function Ai() {}
            function Bi(a, b) {
                var c = di();
                b = void 0 === b ? null : b;
                var d = c.memoizedState;
                if (null !== d && null !== b && Wh(b, d[1])) return d[0];
                c.memoizedState = [
                    a,
                    b
                ];
                return a;
            }
            function Ci(a, b) {
                var c = di();
                b = void 0 === b ? null : b;
                var d = c.memoizedState;
                if (null !== d && null !== b && Wh(b, d[1])) return d[0];
                a = a();
                c.memoizedState = [
                    a,
                    b
                ];
                return a;
            }
            function Di(a, b, c) {
                if (0 === (Rh & 21)) return a.baseState && (a.baseState = false, Ug = true), a.memoizedState = c;
                He(c, b) || (c = yc(), N.lanes |= c, hh |= c, a.baseState = true);
                return b;
            }
            function Ei(a, b) {
                var c = C;
                C = 0 !== c && 4 > c ? c : 4;
                a(true);
                var d = Qh.transition;
                Qh.transition = {};
                try {
                    a(false), b();
                } finally{
                    C = c, Qh.transition = d;
                }
            }
            function Fi() {
                return di().memoizedState;
            }
            function Gi(a, b, c) {
                var d = lh(a);
                c = {
                    lane: d,
                    action: c,
                    hasEagerState: false,
                    eagerState: null,
                    next: null
                };
                if (Hi(a)) Ii(b, c);
                else if (c = Yg(a, b, c, d), null !== c) {
                    var e = L();
                    mh(c, a, d, e);
                    Ji(c, b, d);
                }
            }
            function ri(a, b, c) {
                var d = lh(a), e = {
                    lane: d,
                    action: c,
                    hasEagerState: false,
                    eagerState: null,
                    next: null
                };
                if (Hi(a)) Ii(b, e);
                else {
                    var f = a.alternate;
                    if (0 === a.lanes && (null === f || 0 === f.lanes) && (f = b.lastRenderedReducer, null !== f)) try {
                        var g = b.lastRenderedState, h = f(g, c);
                        e.hasEagerState = true;
                        e.eagerState = h;
                        if (He(h, g)) {
                            var k = b.interleaved;
                            null === k ? (e.next = e, Xg(b)) : (e.next = k.next, k.next = e);
                            b.interleaved = e;
                            return;
                        }
                    } catch (l) {} finally{}
                    c = Yg(a, b, e, d);
                    null !== c && (e = L(), mh(c, a, d, e), Ji(c, b, d));
                }
            }
            function Hi(a) {
                var b = a.alternate;
                return a === N || null !== b && b === N;
            }
            function Ii(a, b) {
                Th = Sh = true;
                var c = a.pending;
                null === c ? b.next = b : (b.next = c.next, c.next = b);
                a.pending = b;
            }
            function Ji(a, b, c) {
                if (0 !== (c & 4194240)) {
                    var d = b.lanes;
                    d &= a.pendingLanes;
                    c |= d;
                    b.lanes = c;
                    Cc(a, c);
                }
            }
            var ai = {
                readContext: Vg,
                useCallback: Q,
                useContext: Q,
                useEffect: Q,
                useImperativeHandle: Q,
                useInsertionEffect: Q,
                useLayoutEffect: Q,
                useMemo: Q,
                useReducer: Q,
                useRef: Q,
                useState: Q,
                useDebugValue: Q,
                useDeferredValue: Q,
                useTransition: Q,
                useMutableSource: Q,
                useSyncExternalStore: Q,
                useId: Q,
                unstable_isNewReconciler: false
            };
            var Yh = {
                readContext: Vg,
                useCallback: function(a, b) {
                    ci().memoizedState = [
                        a,
                        void 0 === b ? null : b
                    ];
                    return a;
                },
                useContext: Vg,
                useEffect: vi,
                useImperativeHandle: function(a, b, c) {
                    c = null !== c && void 0 !== c ? c.concat([
                        a
                    ]) : null;
                    return ti(4194308, 4, yi.bind(null, b, a), c);
                },
                useLayoutEffect: function(a, b) {
                    return ti(4194308, 4, a, b);
                },
                useInsertionEffect: function(a, b) {
                    return ti(4, 2, a, b);
                },
                useMemo: function(a, b) {
                    var c = ci();
                    b = void 0 === b ? null : b;
                    a = a();
                    c.memoizedState = [
                        a,
                        b
                    ];
                    return a;
                },
                useReducer: function(a, b, c) {
                    var d = ci();
                    b = void 0 !== c ? c(b) : b;
                    d.memoizedState = d.baseState = b;
                    a = {
                        pending: null,
                        interleaved: null,
                        lanes: 0,
                        dispatch: null,
                        lastRenderedReducer: a,
                        lastRenderedState: b
                    };
                    d.queue = a;
                    a = a.dispatch = Gi.bind(null, N, a);
                    return [
                        d.memoizedState,
                        a
                    ];
                },
                useRef: function(a) {
                    var b = ci();
                    a = {
                        current: a
                    };
                    return b.memoizedState = a;
                },
                useState: qi,
                useDebugValue: Ai,
                useDeferredValue: function(a) {
                    return ci().memoizedState = a;
                },
                useTransition: function() {
                    var a = qi(false), b = a[0];
                    a = Ei.bind(null, a[1]);
                    ci().memoizedState = a;
                    return [
                        b,
                        a
                    ];
                },
                useMutableSource: function() {},
                useSyncExternalStore: function(a, b, c) {
                    var d = N, e = ci();
                    if (I) {
                        if (void 0 === c) throw Error(p(407));
                        c = c();
                    } else {
                        c = b();
                        if (null === R) throw Error(p(349));
                        0 !== (Rh & 30) || ni(d, b, c);
                    }
                    e.memoizedState = c;
                    var f = {
                        value: c,
                        getSnapshot: b
                    };
                    e.queue = f;
                    vi(ki.bind(null, d, f, a), [
                        a
                    ]);
                    d.flags |= 2048;
                    li(9, mi.bind(null, d, f, c, b), void 0, null);
                    return c;
                },
                useId: function() {
                    var a = ci(), b = R.identifierPrefix;
                    if (I) {
                        var c = sg;
                        var d = rg;
                        c = (d & ~(1 << 32 - oc(d) - 1)).toString(32) + c;
                        b = ":" + b + "R" + c;
                        c = Uh++;
                        0 < c && (b += "H" + c.toString(32));
                        b += ":";
                    } else c = Vh++, b = ":" + b + "r" + c.toString(32) + ":";
                    return a.memoizedState = b;
                },
                unstable_isNewReconciler: false
            };
            var Zh = {
                readContext: Vg,
                useCallback: Bi,
                useContext: Vg,
                useEffect: ji,
                useImperativeHandle: zi,
                useInsertionEffect: wi,
                useLayoutEffect: xi,
                useMemo: Ci,
                useReducer: fi,
                useRef: si,
                useState: function() {
                    return fi(ei);
                },
                useDebugValue: Ai,
                useDeferredValue: function(a) {
                    var b = di();
                    return Di(b, O.memoizedState, a);
                },
                useTransition: function() {
                    var a = fi(ei)[0], b = di().memoizedState;
                    return [
                        a,
                        b
                    ];
                },
                useMutableSource: hi,
                useSyncExternalStore: ii,
                useId: Fi,
                unstable_isNewReconciler: false
            };
            var $h = {
                readContext: Vg,
                useCallback: Bi,
                useContext: Vg,
                useEffect: ji,
                useImperativeHandle: zi,
                useInsertionEffect: wi,
                useLayoutEffect: xi,
                useMemo: Ci,
                useReducer: gi,
                useRef: si,
                useState: function() {
                    return gi(ei);
                },
                useDebugValue: Ai,
                useDeferredValue: function(a) {
                    var b = di();
                    return null === O ? b.memoizedState = a : Di(b, O.memoizedState, a);
                },
                useTransition: function() {
                    var a = gi(ei)[0], b = di().memoizedState;
                    return [
                        a,
                        b
                    ];
                },
                useMutableSource: hi,
                useSyncExternalStore: ii,
                useId: Fi,
                unstable_isNewReconciler: false
            };
            function Ki(a, b) {
                try {
                    var c = "", d = b;
                    do c += Pa(d), d = d.return;
                    while (d)
                    var e = c;
                } catch (f) {
                    e = "\nError generating stack: " + f.message + "\n" + f.stack;
                }
                return {
                    value: a,
                    source: b,
                    stack: e,
                    digest: null
                };
            }
            function Li(a, b, c) {
                return {
                    value: a,
                    source: null,
                    stack: null != c ? c : null,
                    digest: null != b ? b : null
                };
            }
            function Mi(a, b) {
                try {
                    console.error(b.value);
                } catch (c) {
                    setTimeout(function() {
                        throw c;
                    });
                }
            }
            var Ni = "function" === typeof WeakMap ? WeakMap : Map;
            function Oi(a, b, c) {
                c = ch(-1, c);
                c.tag = 3;
                c.payload = {
                    element: null
                };
                var d = b.value;
                c.callback = function() {
                    Pi || (Pi = true, Qi = d);
                    Mi(a, b);
                };
                return c;
            }
            function Ri(a, b, c) {
                c = ch(-1, c);
                c.tag = 3;
                var d = a.type.getDerivedStateFromError;
                if ("function" === typeof d) {
                    var e = b.value;
                    c.payload = function() {
                        return d(e);
                    };
                    c.callback = function() {
                        Mi(a, b);
                    };
                }
                var f = a.stateNode;
                null !== f && "function" === typeof f.componentDidCatch && (c.callback = function() {
                    Mi(a, b);
                    "function" !== typeof d && (null === Si ? Si = /* @__PURE__ */ new Set([
                        this
                    ]) : Si.add(this));
                    var c2 = b.stack;
                    this.componentDidCatch(b.value, {
                        componentStack: null !== c2 ? c2 : ""
                    });
                });
                return c;
            }
            function Ti(a, b, c) {
                var d = a.pingCache;
                if (null === d) {
                    d = a.pingCache = new Ni();
                    var e = /* @__PURE__ */ new Set();
                    d.set(b, e);
                } else e = d.get(b), void 0 === e && (e = /* @__PURE__ */ new Set(), d.set(b, e));
                e.has(c) || (e.add(c), a = Ui.bind(null, a, b, c), b.then(a, a));
            }
            function Vi(a) {
                do {
                    var b;
                    if (b = 13 === a.tag) b = a.memoizedState, b = null !== b ? null !== b.dehydrated ? true : false : true;
                    if (b) return a;
                    a = a.return;
                }while (null !== a)
                return null;
            }
            function Wi(a, b, c, d, e) {
                if (0 === (a.mode & 1)) return a === b ? a.flags |= 65536 : (a.flags |= 128, c.flags |= 131072, c.flags &= -52805, 1 === c.tag && (null === c.alternate ? c.tag = 17 : (b = ch(-1, 1), b.tag = 2, dh(c, b, 1))), c.lanes |= 1), a;
                a.flags |= 65536;
                a.lanes = e;
                return a;
            }
            var Xi = ua.ReactCurrentOwner;
            var Ug = false;
            function Yi(a, b, c, d) {
                b.child = null === a ? Ch(b, null, c, d) : Bh(b, a.child, c, d);
            }
            function Zi(a, b, c, d, e) {
                c = c.render;
                var f = b.ref;
                Tg(b, e);
                d = Xh(a, b, c, d, f, e);
                c = bi();
                if (null !== a && !Ug) return b.updateQueue = a.updateQueue, b.flags &= -2053, a.lanes &= ~e, $i(a, b, e);
                I && c && vg(b);
                b.flags |= 1;
                Yi(a, b, d, e);
                return b.child;
            }
            function aj(a, b, c, d, e) {
                if (null === a) {
                    var f = c.type;
                    if ("function" === typeof f && !bj(f) && void 0 === f.defaultProps && null === c.compare && void 0 === c.defaultProps) return b.tag = 15, b.type = f, cj(a, b, f, d, e);
                    a = yh(c.type, null, d, b, b.mode, e);
                    a.ref = b.ref;
                    a.return = b;
                    return b.child = a;
                }
                f = a.child;
                if (0 === (a.lanes & e)) {
                    var g = f.memoizedProps;
                    c = c.compare;
                    c = null !== c ? c : Ie;
                    if (c(g, d) && a.ref === b.ref) return $i(a, b, e);
                }
                b.flags |= 1;
                a = wh(f, d);
                a.ref = b.ref;
                a.return = b;
                return b.child = a;
            }
            function cj(a, b, c, d, e) {
                if (null !== a) {
                    var f = a.memoizedProps;
                    if (Ie(f, d) && a.ref === b.ref) if (Ug = false, b.pendingProps = d = f, 0 !== (a.lanes & e)) 0 !== (a.flags & 131072) && (Ug = true);
                    else return b.lanes = a.lanes, $i(a, b, e);
                }
                return dj(a, b, c, d, e);
            }
            function ej(a, b, c) {
                var d = b.pendingProps, e = d.children, f = null !== a ? a.memoizedState : null;
                if ("hidden" === d.mode) if (0 === (b.mode & 1)) b.memoizedState = {
                    baseLanes: 0,
                    cachePool: null,
                    transitions: null
                }, G(fj, gj), gj |= c;
                else {
                    if (0 === (c & 1073741824)) return a = null !== f ? f.baseLanes | c : c, b.lanes = b.childLanes = 1073741824, b.memoizedState = {
                        baseLanes: a,
                        cachePool: null,
                        transitions: null
                    }, b.updateQueue = null, G(fj, gj), gj |= a, null;
                    b.memoizedState = {
                        baseLanes: 0,
                        cachePool: null,
                        transitions: null
                    };
                    d = null !== f ? f.baseLanes : c;
                    G(fj, gj);
                    gj |= d;
                }
                else null !== f ? (d = f.baseLanes | c, b.memoizedState = null) : d = c, G(fj, gj), gj |= d;
                Yi(a, b, e, c);
                return b.child;
            }
            function hj(a, b) {
                var c = b.ref;
                if (null === a && null !== c || null !== a && a.ref !== c) b.flags |= 512, b.flags |= 2097152;
            }
            function dj(a, b, c, d, e) {
                var f = Zf(c) ? Xf : H.current;
                f = Yf(b, f);
                Tg(b, e);
                c = Xh(a, b, c, d, f, e);
                d = bi();
                if (null !== a && !Ug) return b.updateQueue = a.updateQueue, b.flags &= -2053, a.lanes &= ~e, $i(a, b, e);
                I && d && vg(b);
                b.flags |= 1;
                Yi(a, b, c, e);
                return b.child;
            }
            function ij(a, b, c, d, e) {
                if (Zf(c)) {
                    var f = true;
                    cg(b);
                } else f = false;
                Tg(b, e);
                if (null === b.stateNode) jj(a, b), ph(b, c, d), rh(b, c, d, e), d = true;
                else if (null === a) {
                    var g = b.stateNode, h = b.memoizedProps;
                    g.props = h;
                    var k = g.context, l = c.contextType;
                    "object" === typeof l && null !== l ? l = Vg(l) : (l = Zf(c) ? Xf : H.current, l = Yf(b, l));
                    var m = c.getDerivedStateFromProps, q = "function" === typeof m || "function" === typeof g.getSnapshotBeforeUpdate;
                    q || "function" !== typeof g.UNSAFE_componentWillReceiveProps && "function" !== typeof g.componentWillReceiveProps || (h !== d || k !== l) && qh(b, g, d, l);
                    $g = false;
                    var r = b.memoizedState;
                    g.state = r;
                    gh(b, d, g, e);
                    k = b.memoizedState;
                    h !== d || r !== k || Wf.current || $g ? ("function" === typeof m && (kh(b, c, m, d), k = b.memoizedState), (h = $g || oh(b, c, h, d, r, k, l)) ? (q || "function" !== typeof g.UNSAFE_componentWillMount && "function" !== typeof g.componentWillMount || ("function" === typeof g.componentWillMount && g.componentWillMount(), "function" === typeof g.UNSAFE_componentWillMount && g.UNSAFE_componentWillMount()), "function" === typeof g.componentDidMount && (b.flags |= 4194308)) : ("function" === typeof g.componentDidMount && (b.flags |= 4194308), b.memoizedProps = d, b.memoizedState = k), g.props = d, g.state = k, g.context = l, d = h) : ("function" === typeof g.componentDidMount && (b.flags |= 4194308), d = false);
                } else {
                    g = b.stateNode;
                    bh(a, b);
                    h = b.memoizedProps;
                    l = b.type === b.elementType ? h : Lg(b.type, h);
                    g.props = l;
                    q = b.pendingProps;
                    r = g.context;
                    k = c.contextType;
                    "object" === typeof k && null !== k ? k = Vg(k) : (k = Zf(c) ? Xf : H.current, k = Yf(b, k));
                    var y = c.getDerivedStateFromProps;
                    (m = "function" === typeof y || "function" === typeof g.getSnapshotBeforeUpdate) || "function" !== typeof g.UNSAFE_componentWillReceiveProps && "function" !== typeof g.componentWillReceiveProps || (h !== q || r !== k) && qh(b, g, d, k);
                    $g = false;
                    r = b.memoizedState;
                    g.state = r;
                    gh(b, d, g, e);
                    var n = b.memoizedState;
                    h !== q || r !== n || Wf.current || $g ? ("function" === typeof y && (kh(b, c, y, d), n = b.memoizedState), (l = $g || oh(b, c, l, d, r, n, k) || false) ? (m || "function" !== typeof g.UNSAFE_componentWillUpdate && "function" !== typeof g.componentWillUpdate || ("function" === typeof g.componentWillUpdate && g.componentWillUpdate(d, n, k), "function" === typeof g.UNSAFE_componentWillUpdate && g.UNSAFE_componentWillUpdate(d, n, k)), "function" === typeof g.componentDidUpdate && (b.flags |= 4), "function" === typeof g.getSnapshotBeforeUpdate && (b.flags |= 1024)) : ("function" !== typeof g.componentDidUpdate || h === a.memoizedProps && r === a.memoizedState || (b.flags |= 4), "function" !== typeof g.getSnapshotBeforeUpdate || h === a.memoizedProps && r === a.memoizedState || (b.flags |= 1024), b.memoizedProps = d, b.memoizedState = n), g.props = d, g.state = n, g.context = k, d = l) : ("function" !== typeof g.componentDidUpdate || h === a.memoizedProps && r === a.memoizedState || (b.flags |= 4), "function" !== typeof g.getSnapshotBeforeUpdate || h === a.memoizedProps && r === a.memoizedState || (b.flags |= 1024), d = false);
                }
                return kj(a, b, c, d, f, e);
            }
            function kj(a, b, c, d, e, f) {
                hj(a, b);
                var g = 0 !== (b.flags & 128);
                if (!d && !g) return e && dg(b, c, false), $i(a, b, f);
                d = b.stateNode;
                Xi.current = b;
                var h = g && "function" !== typeof c.getDerivedStateFromError ? null : d.render();
                b.flags |= 1;
                null !== a && g ? (b.child = Bh(b, a.child, null, f), b.child = Bh(b, null, h, f)) : Yi(a, b, h, f);
                b.memoizedState = d.state;
                e && dg(b, c, true);
                return b.child;
            }
            function lj(a) {
                var b = a.stateNode;
                b.pendingContext ? ag(a, b.pendingContext, b.pendingContext !== b.context) : b.context && ag(a, b.context, false);
                Ih(a, b.containerInfo);
            }
            function mj(a, b, c, d, e) {
                Ig();
                Jg(e);
                b.flags |= 256;
                Yi(a, b, c, d);
                return b.child;
            }
            var nj = {
                dehydrated: null,
                treeContext: null,
                retryLane: 0
            };
            function oj(a) {
                return {
                    baseLanes: a,
                    cachePool: null,
                    transitions: null
                };
            }
            function pj(a, b, c) {
                var d = b.pendingProps, e = M.current, f = false, g = 0 !== (b.flags & 128), h;
                (h = g) || (h = null !== a && null === a.memoizedState ? false : 0 !== (e & 2));
                if (h) f = true, b.flags &= -129;
                else if (null === a || null !== a.memoizedState) e |= 1;
                G(M, e & 1);
                if (null === a) {
                    Eg(b);
                    a = b.memoizedState;
                    if (null !== a && (a = a.dehydrated, null !== a)) return 0 === (b.mode & 1) ? b.lanes = 1 : "$!" === a.data ? b.lanes = 8 : b.lanes = 1073741824, null;
                    g = d.children;
                    a = d.fallback;
                    return f ? (d = b.mode, f = b.child, g = {
                        mode: "hidden",
                        children: g
                    }, 0 === (d & 1) && null !== f ? (f.childLanes = 0, f.pendingProps = g) : f = qj(g, d, 0, null), a = Ah(a, d, c, null), f.return = b, a.return = b, f.sibling = a, b.child = f, b.child.memoizedState = oj(c), b.memoizedState = nj, a) : rj(b, g);
                }
                e = a.memoizedState;
                if (null !== e && (h = e.dehydrated, null !== h)) return sj(a, b, g, d, h, e, c);
                if (f) {
                    f = d.fallback;
                    g = b.mode;
                    e = a.child;
                    h = e.sibling;
                    var k = {
                        mode: "hidden",
                        children: d.children
                    };
                    0 === (g & 1) && b.child !== e ? (d = b.child, d.childLanes = 0, d.pendingProps = k, b.deletions = null) : (d = wh(e, k), d.subtreeFlags = e.subtreeFlags & 14680064);
                    null !== h ? f = wh(h, f) : (f = Ah(f, g, c, null), f.flags |= 2);
                    f.return = b;
                    d.return = b;
                    d.sibling = f;
                    b.child = d;
                    d = f;
                    f = b.child;
                    g = a.child.memoizedState;
                    g = null === g ? oj(c) : {
                        baseLanes: g.baseLanes | c,
                        cachePool: null,
                        transitions: g.transitions
                    };
                    f.memoizedState = g;
                    f.childLanes = a.childLanes & ~c;
                    b.memoizedState = nj;
                    return d;
                }
                f = a.child;
                a = f.sibling;
                d = wh(f, {
                    mode: "visible",
                    children: d.children
                });
                0 === (b.mode & 1) && (d.lanes = c);
                d.return = b;
                d.sibling = null;
                null !== a && (c = b.deletions, null === c ? (b.deletions = [
                    a
                ], b.flags |= 16) : c.push(a));
                b.child = d;
                b.memoizedState = null;
                return d;
            }
            function rj(a, b) {
                b = qj({
                    mode: "visible",
                    children: b
                }, a.mode, 0, null);
                b.return = a;
                return a.child = b;
            }
            function tj(a, b, c, d) {
                null !== d && Jg(d);
                Bh(b, a.child, null, c);
                a = rj(b, b.pendingProps.children);
                a.flags |= 2;
                b.memoizedState = null;
                return a;
            }
            function sj(a, b, c, d, e, f, g) {
                if (c) {
                    if (b.flags & 256) return b.flags &= -257, d = Li(Error(p(422))), tj(a, b, g, d);
                    if (null !== b.memoizedState) return b.child = a.child, b.flags |= 128, null;
                    f = d.fallback;
                    e = b.mode;
                    d = qj({
                        mode: "visible",
                        children: d.children
                    }, e, 0, null);
                    f = Ah(f, e, g, null);
                    f.flags |= 2;
                    d.return = b;
                    f.return = b;
                    d.sibling = f;
                    b.child = d;
                    0 !== (b.mode & 1) && Bh(b, a.child, null, g);
                    b.child.memoizedState = oj(g);
                    b.memoizedState = nj;
                    return f;
                }
                if (0 === (b.mode & 1)) return tj(a, b, g, null);
                if ("$!" === e.data) {
                    d = e.nextSibling && e.nextSibling.dataset;
                    if (d) var h = d.dgst;
                    d = h;
                    f = Error(p(419));
                    d = Li(f, d, void 0);
                    return tj(a, b, g, d);
                }
                h = 0 !== (g & a.childLanes);
                if (Ug || h) {
                    d = R;
                    if (null !== d) {
                        switch(g & -g){
                            case 4:
                                e = 2;
                                break;
                            case 16:
                                e = 8;
                                break;
                            case 64:
                            case 128:
                            case 256:
                            case 512:
                            case 1024:
                            case 2048:
                            case 4096:
                            case 8192:
                            case 16384:
                            case 32768:
                            case 65536:
                            case 131072:
                            case 262144:
                            case 524288:
                            case 1048576:
                            case 2097152:
                            case 4194304:
                            case 8388608:
                            case 16777216:
                            case 33554432:
                            case 67108864:
                                e = 32;
                                break;
                            case 536870912:
                                e = 268435456;
                                break;
                            default:
                                e = 0;
                        }
                        e = 0 !== (e & (d.suspendedLanes | g)) ? 0 : e;
                        0 !== e && e !== f.retryLane && (f.retryLane = e, Zg(a, e), mh(d, a, e, -1));
                    }
                    uj();
                    d = Li(Error(p(421)));
                    return tj(a, b, g, d);
                }
                if ("$?" === e.data) return b.flags |= 128, b.child = a.child, b = vj.bind(null, a), e._reactRetry = b, null;
                a = f.treeContext;
                yg = Lf(e.nextSibling);
                xg = b;
                I = true;
                zg = null;
                null !== a && (og[pg++] = rg, og[pg++] = sg, og[pg++] = qg, rg = a.id, sg = a.overflow, qg = b);
                b = rj(b, d.children);
                b.flags |= 4096;
                return b;
            }
            function wj(a, b, c) {
                a.lanes |= b;
                var d = a.alternate;
                null !== d && (d.lanes |= b);
                Sg(a.return, b, c);
            }
            function xj(a, b, c, d, e) {
                var f = a.memoizedState;
                null === f ? a.memoizedState = {
                    isBackwards: b,
                    rendering: null,
                    renderingStartTime: 0,
                    last: d,
                    tail: c,
                    tailMode: e
                } : (f.isBackwards = b, f.rendering = null, f.renderingStartTime = 0, f.last = d, f.tail = c, f.tailMode = e);
            }
            function yj(a, b, c) {
                var d = b.pendingProps, e = d.revealOrder, f = d.tail;
                Yi(a, b, d.children, c);
                d = M.current;
                if (0 !== (d & 2)) d = d & 1 | 2, b.flags |= 128;
                else {
                    if (null !== a && 0 !== (a.flags & 128)) a: for(a = b.child; null !== a;){
                        if (13 === a.tag) null !== a.memoizedState && wj(a, c, b);
                        else if (19 === a.tag) wj(a, c, b);
                        else if (null !== a.child) {
                            a.child.return = a;
                            a = a.child;
                            continue;
                        }
                        if (a === b) break a;
                        for(; null === a.sibling;){
                            if (null === a.return || a.return === b) break a;
                            a = a.return;
                        }
                        a.sibling.return = a.return;
                        a = a.sibling;
                    }
                    d &= 1;
                }
                G(M, d);
                if (0 === (b.mode & 1)) b.memoizedState = null;
                else switch(e){
                    case "forwards":
                        c = b.child;
                        for(e = null; null !== c;)a = c.alternate, null !== a && null === Mh(a) && (e = c), c = c.sibling;
                        c = e;
                        null === c ? (e = b.child, b.child = null) : (e = c.sibling, c.sibling = null);
                        xj(b, false, e, c, f);
                        break;
                    case "backwards":
                        c = null;
                        e = b.child;
                        for(b.child = null; null !== e;){
                            a = e.alternate;
                            if (null !== a && null === Mh(a)) {
                                b.child = e;
                                break;
                            }
                            a = e.sibling;
                            e.sibling = c;
                            c = e;
                            e = a;
                        }
                        xj(b, true, c, null, f);
                        break;
                    case "together":
                        xj(b, false, null, null, void 0);
                        break;
                    default:
                        b.memoizedState = null;
                }
                return b.child;
            }
            function jj(a, b) {
                0 === (b.mode & 1) && null !== a && (a.alternate = null, b.alternate = null, b.flags |= 2);
            }
            function $i(a, b, c) {
                null !== a && (b.dependencies = a.dependencies);
                hh |= b.lanes;
                if (0 === (c & b.childLanes)) return null;
                if (null !== a && b.child !== a.child) throw Error(p(153));
                if (null !== b.child) {
                    a = b.child;
                    c = wh(a, a.pendingProps);
                    b.child = c;
                    for(c.return = b; null !== a.sibling;)a = a.sibling, c = c.sibling = wh(a, a.pendingProps), c.return = b;
                    c.sibling = null;
                }
                return b.child;
            }
            function zj(a, b, c) {
                switch(b.tag){
                    case 3:
                        lj(b);
                        Ig();
                        break;
                    case 5:
                        Kh(b);
                        break;
                    case 1:
                        Zf(b.type) && cg(b);
                        break;
                    case 4:
                        Ih(b, b.stateNode.containerInfo);
                        break;
                    case 10:
                        var d = b.type._context, e = b.memoizedProps.value;
                        G(Mg, d._currentValue);
                        d._currentValue = e;
                        break;
                    case 13:
                        d = b.memoizedState;
                        if (null !== d) {
                            if (null !== d.dehydrated) return G(M, M.current & 1), b.flags |= 128, null;
                            if (0 !== (c & b.child.childLanes)) return pj(a, b, c);
                            G(M, M.current & 1);
                            a = $i(a, b, c);
                            return null !== a ? a.sibling : null;
                        }
                        G(M, M.current & 1);
                        break;
                    case 19:
                        d = 0 !== (c & b.childLanes);
                        if (0 !== (a.flags & 128)) {
                            if (d) return yj(a, b, c);
                            b.flags |= 128;
                        }
                        e = b.memoizedState;
                        null !== e && (e.rendering = null, e.tail = null, e.lastEffect = null);
                        G(M, M.current);
                        if (d) break;
                        else return null;
                    case 22:
                    case 23:
                        return b.lanes = 0, ej(a, b, c);
                }
                return $i(a, b, c);
            }
            var Aj;
            var Bj;
            var Cj;
            var Dj;
            Aj = function(a, b) {
                for(var c = b.child; null !== c;){
                    if (5 === c.tag || 6 === c.tag) a.appendChild(c.stateNode);
                    else if (4 !== c.tag && null !== c.child) {
                        c.child.return = c;
                        c = c.child;
                        continue;
                    }
                    if (c === b) break;
                    for(; null === c.sibling;){
                        if (null === c.return || c.return === b) return;
                        c = c.return;
                    }
                    c.sibling.return = c.return;
                    c = c.sibling;
                }
            };
            Bj = function() {};
            Cj = function(a, b, c, d) {
                var e = a.memoizedProps;
                if (e !== d) {
                    a = b.stateNode;
                    Hh(Eh.current);
                    var f = null;
                    switch(c){
                        case "input":
                            e = Ya(a, e);
                            d = Ya(a, d);
                            f = [];
                            break;
                        case "select":
                            e = A({}, e, {
                                value: void 0
                            });
                            d = A({}, d, {
                                value: void 0
                            });
                            f = [];
                            break;
                        case "textarea":
                            e = gb(a, e);
                            d = gb(a, d);
                            f = [];
                            break;
                        default:
                            "function" !== typeof e.onClick && "function" === typeof d.onClick && (a.onclick = Bf);
                    }
                    ub(c, d);
                    var g;
                    c = null;
                    for(l in e)if (!d.hasOwnProperty(l) && e.hasOwnProperty(l) && null != e[l]) if ("style" === l) {
                        var h = e[l];
                        for(g in h)h.hasOwnProperty(g) && (c || (c = {}), c[g] = "");
                    } else "dangerouslySetInnerHTML" !== l && "children" !== l && "suppressContentEditableWarning" !== l && "suppressHydrationWarning" !== l && "autoFocus" !== l && (ea.hasOwnProperty(l) ? f || (f = []) : (f = f || []).push(l, null));
                    for(l in d){
                        var k = d[l];
                        h = null != e ? e[l] : void 0;
                        if (d.hasOwnProperty(l) && k !== h && (null != k || null != h)) if ("style" === l) if (h) {
                            for(g in h)!h.hasOwnProperty(g) || k && k.hasOwnProperty(g) || (c || (c = {}), c[g] = "");
                            for(g in k)k.hasOwnProperty(g) && h[g] !== k[g] && (c || (c = {}), c[g] = k[g]);
                        } else c || (f || (f = []), f.push(l, c)), c = k;
                        else "dangerouslySetInnerHTML" === l ? (k = k ? k.__html : void 0, h = h ? h.__html : void 0, null != k && h !== k && (f = f || []).push(l, k)) : "children" === l ? "string" !== typeof k && "number" !== typeof k || (f = f || []).push(l, "" + k) : "suppressContentEditableWarning" !== l && "suppressHydrationWarning" !== l && (ea.hasOwnProperty(l) ? (null != k && "onScroll" === l && D("scroll", a), f || h === k || (f = [])) : (f = f || []).push(l, k));
                    }
                    c && (f = f || []).push("style", c);
                    var l = f;
                    if (b.updateQueue = l) b.flags |= 4;
                }
            };
            Dj = function(a, b, c, d) {
                c !== d && (b.flags |= 4);
            };
            function Ej(a, b) {
                if (!I) switch(a.tailMode){
                    case "hidden":
                        b = a.tail;
                        for(var c = null; null !== b;)null !== b.alternate && (c = b), b = b.sibling;
                        null === c ? a.tail = null : c.sibling = null;
                        break;
                    case "collapsed":
                        c = a.tail;
                        for(var d = null; null !== c;)null !== c.alternate && (d = c), c = c.sibling;
                        null === d ? b || null === a.tail ? a.tail = null : a.tail.sibling = null : d.sibling = null;
                }
            }
            function S(a) {
                var b = null !== a.alternate && a.alternate.child === a.child, c = 0, d = 0;
                if (b) for(var e = a.child; null !== e;)c |= e.lanes | e.childLanes, d |= e.subtreeFlags & 14680064, d |= e.flags & 14680064, e.return = a, e = e.sibling;
                else for(e = a.child; null !== e;)c |= e.lanes | e.childLanes, d |= e.subtreeFlags, d |= e.flags, e.return = a, e = e.sibling;
                a.subtreeFlags |= d;
                a.childLanes = c;
                return b;
            }
            function Fj(a, b, c) {
                var d = b.pendingProps;
                wg(b);
                switch(b.tag){
                    case 2:
                    case 16:
                    case 15:
                    case 0:
                    case 11:
                    case 7:
                    case 8:
                    case 12:
                    case 9:
                    case 14:
                        return S(b), null;
                    case 1:
                        return Zf(b.type) && $f(), S(b), null;
                    case 3:
                        d = b.stateNode;
                        Jh();
                        E(Wf);
                        E(H);
                        Oh();
                        d.pendingContext && (d.context = d.pendingContext, d.pendingContext = null);
                        if (null === a || null === a.child) Gg(b) ? b.flags |= 4 : null === a || a.memoizedState.isDehydrated && 0 === (b.flags & 256) || (b.flags |= 1024, null !== zg && (Gj(zg), zg = null));
                        Bj(a, b);
                        S(b);
                        return null;
                    case 5:
                        Lh(b);
                        var e = Hh(Gh.current);
                        c = b.type;
                        if (null !== a && null != b.stateNode) Cj(a, b, c, d, e), a.ref !== b.ref && (b.flags |= 512, b.flags |= 2097152);
                        else {
                            if (!d) {
                                if (null === b.stateNode) throw Error(p(166));
                                S(b);
                                return null;
                            }
                            a = Hh(Eh.current);
                            if (Gg(b)) {
                                d = b.stateNode;
                                c = b.type;
                                var f = b.memoizedProps;
                                d[Of] = b;
                                d[Pf] = f;
                                a = 0 !== (b.mode & 1);
                                switch(c){
                                    case "dialog":
                                        D("cancel", d);
                                        D("close", d);
                                        break;
                                    case "iframe":
                                    case "object":
                                    case "embed":
                                        D("load", d);
                                        break;
                                    case "video":
                                    case "audio":
                                        for(e = 0; e < lf.length; e++)D(lf[e], d);
                                        break;
                                    case "source":
                                        D("error", d);
                                        break;
                                    case "img":
                                    case "image":
                                    case "link":
                                        D("error", d);
                                        D("load", d);
                                        break;
                                    case "details":
                                        D("toggle", d);
                                        break;
                                    case "input":
                                        Za(d, f);
                                        D("invalid", d);
                                        break;
                                    case "select":
                                        d._wrapperState = {
                                            wasMultiple: !!f.multiple
                                        };
                                        D("invalid", d);
                                        break;
                                    case "textarea":
                                        hb(d, f), D("invalid", d);
                                }
                                ub(c, f);
                                e = null;
                                for(var g in f)if (f.hasOwnProperty(g)) {
                                    var h = f[g];
                                    "children" === g ? "string" === typeof h ? d.textContent !== h && (true !== f.suppressHydrationWarning && Af(d.textContent, h, a), e = [
                                        "children",
                                        h
                                    ]) : "number" === typeof h && d.textContent !== "" + h && (true !== f.suppressHydrationWarning && Af(d.textContent, h, a), e = [
                                        "children",
                                        "" + h
                                    ]) : ea.hasOwnProperty(g) && null != h && "onScroll" === g && D("scroll", d);
                                }
                                switch(c){
                                    case "input":
                                        Va(d);
                                        db(d, f, true);
                                        break;
                                    case "textarea":
                                        Va(d);
                                        jb(d);
                                        break;
                                    case "select":
                                    case "option":
                                        break;
                                    default:
                                        "function" === typeof f.onClick && (d.onclick = Bf);
                                }
                                d = e;
                                b.updateQueue = d;
                                null !== d && (b.flags |= 4);
                            } else {
                                g = 9 === e.nodeType ? e : e.ownerDocument;
                                "http://www.w3.org/1999/xhtml" === a && (a = kb(c));
                                "http://www.w3.org/1999/xhtml" === a ? "script" === c ? (a = g.createElement("div"), a.innerHTML = "<script><\/script>", a = a.removeChild(a.firstChild)) : "string" === typeof d.is ? a = g.createElement(c, {
                                    is: d.is
                                }) : (a = g.createElement(c), "select" === c && (g = a, d.multiple ? g.multiple = true : d.size && (g.size = d.size))) : a = g.createElementNS(a, c);
                                a[Of] = b;
                                a[Pf] = d;
                                Aj(a, b, false, false);
                                b.stateNode = a;
                                a: {
                                    g = vb(c, d);
                                    switch(c){
                                        case "dialog":
                                            D("cancel", a);
                                            D("close", a);
                                            e = d;
                                            break;
                                        case "iframe":
                                        case "object":
                                        case "embed":
                                            D("load", a);
                                            e = d;
                                            break;
                                        case "video":
                                        case "audio":
                                            for(e = 0; e < lf.length; e++)D(lf[e], a);
                                            e = d;
                                            break;
                                        case "source":
                                            D("error", a);
                                            e = d;
                                            break;
                                        case "img":
                                        case "image":
                                        case "link":
                                            D("error", a);
                                            D("load", a);
                                            e = d;
                                            break;
                                        case "details":
                                            D("toggle", a);
                                            e = d;
                                            break;
                                        case "input":
                                            Za(a, d);
                                            e = Ya(a, d);
                                            D("invalid", a);
                                            break;
                                        case "option":
                                            e = d;
                                            break;
                                        case "select":
                                            a._wrapperState = {
                                                wasMultiple: !!d.multiple
                                            };
                                            e = A({}, d, {
                                                value: void 0
                                            });
                                            D("invalid", a);
                                            break;
                                        case "textarea":
                                            hb(a, d);
                                            e = gb(a, d);
                                            D("invalid", a);
                                            break;
                                        default:
                                            e = d;
                                    }
                                    ub(c, e);
                                    h = e;
                                    for(f in h)if (h.hasOwnProperty(f)) {
                                        var k = h[f];
                                        "style" === f ? sb(a, k) : "dangerouslySetInnerHTML" === f ? (k = k ? k.__html : void 0, null != k && nb(a, k)) : "children" === f ? "string" === typeof k ? ("textarea" !== c || "" !== k) && ob(a, k) : "number" === typeof k && ob(a, "" + k) : "suppressContentEditableWarning" !== f && "suppressHydrationWarning" !== f && "autoFocus" !== f && (ea.hasOwnProperty(f) ? null != k && "onScroll" === f && D("scroll", a) : null != k && ta(a, f, k, g));
                                    }
                                    switch(c){
                                        case "input":
                                            Va(a);
                                            db(a, d, false);
                                            break;
                                        case "textarea":
                                            Va(a);
                                            jb(a);
                                            break;
                                        case "option":
                                            null != d.value && a.setAttribute("value", "" + Sa(d.value));
                                            break;
                                        case "select":
                                            a.multiple = !!d.multiple;
                                            f = d.value;
                                            null != f ? fb(a, !!d.multiple, f, false) : null != d.defaultValue && fb(a, !!d.multiple, d.defaultValue, true);
                                            break;
                                        default:
                                            "function" === typeof e.onClick && (a.onclick = Bf);
                                    }
                                    switch(c){
                                        case "button":
                                        case "input":
                                        case "select":
                                        case "textarea":
                                            d = !!d.autoFocus;
                                            break a;
                                        case "img":
                                            d = true;
                                            break a;
                                        default:
                                            d = false;
                                    }
                                }
                                d && (b.flags |= 4);
                            }
                            null !== b.ref && (b.flags |= 512, b.flags |= 2097152);
                        }
                        S(b);
                        return null;
                    case 6:
                        if (a && null != b.stateNode) Dj(a, b, a.memoizedProps, d);
                        else {
                            if ("string" !== typeof d && null === b.stateNode) throw Error(p(166));
                            c = Hh(Gh.current);
                            Hh(Eh.current);
                            if (Gg(b)) {
                                d = b.stateNode;
                                c = b.memoizedProps;
                                d[Of] = b;
                                if (f = d.nodeValue !== c) {
                                    if (a = xg, null !== a) switch(a.tag){
                                        case 3:
                                            Af(d.nodeValue, c, 0 !== (a.mode & 1));
                                            break;
                                        case 5:
                                            true !== a.memoizedProps.suppressHydrationWarning && Af(d.nodeValue, c, 0 !== (a.mode & 1));
                                    }
                                }
                                f && (b.flags |= 4);
                            } else d = (9 === c.nodeType ? c : c.ownerDocument).createTextNode(d), d[Of] = b, b.stateNode = d;
                        }
                        S(b);
                        return null;
                    case 13:
                        E(M);
                        d = b.memoizedState;
                        if (null === a || null !== a.memoizedState && null !== a.memoizedState.dehydrated) {
                            if (I && null !== yg && 0 !== (b.mode & 1) && 0 === (b.flags & 128)) Hg(), Ig(), b.flags |= 98560, f = false;
                            else if (f = Gg(b), null !== d && null !== d.dehydrated) {
                                if (null === a) {
                                    if (!f) throw Error(p(318));
                                    f = b.memoizedState;
                                    f = null !== f ? f.dehydrated : null;
                                    if (!f) throw Error(p(317));
                                    f[Of] = b;
                                } else Ig(), 0 === (b.flags & 128) && (b.memoizedState = null), b.flags |= 4;
                                S(b);
                                f = false;
                            } else null !== zg && (Gj(zg), zg = null), f = true;
                            if (!f) return b.flags & 65536 ? b : null;
                        }
                        if (0 !== (b.flags & 128)) return b.lanes = c, b;
                        d = null !== d;
                        d !== (null !== a && null !== a.memoizedState) && d && (b.child.flags |= 8192, 0 !== (b.mode & 1) && (null === a || 0 !== (M.current & 1) ? 0 === T && (T = 3) : uj()));
                        null !== b.updateQueue && (b.flags |= 4);
                        S(b);
                        return null;
                    case 4:
                        return Jh(), Bj(a, b), null === a && sf(b.stateNode.containerInfo), S(b), null;
                    case 10:
                        return Rg(b.type._context), S(b), null;
                    case 17:
                        return Zf(b.type) && $f(), S(b), null;
                    case 19:
                        E(M);
                        f = b.memoizedState;
                        if (null === f) return S(b), null;
                        d = 0 !== (b.flags & 128);
                        g = f.rendering;
                        if (null === g) if (d) Ej(f, false);
                        else {
                            if (0 !== T || null !== a && 0 !== (a.flags & 128)) for(a = b.child; null !== a;){
                                g = Mh(a);
                                if (null !== g) {
                                    b.flags |= 128;
                                    Ej(f, false);
                                    d = g.updateQueue;
                                    null !== d && (b.updateQueue = d, b.flags |= 4);
                                    b.subtreeFlags = 0;
                                    d = c;
                                    for(c = b.child; null !== c;)f = c, a = d, f.flags &= 14680066, g = f.alternate, null === g ? (f.childLanes = 0, f.lanes = a, f.child = null, f.subtreeFlags = 0, f.memoizedProps = null, f.memoizedState = null, f.updateQueue = null, f.dependencies = null, f.stateNode = null) : (f.childLanes = g.childLanes, f.lanes = g.lanes, f.child = g.child, f.subtreeFlags = 0, f.deletions = null, f.memoizedProps = g.memoizedProps, f.memoizedState = g.memoizedState, f.updateQueue = g.updateQueue, f.type = g.type, a = g.dependencies, f.dependencies = null === a ? null : {
                                        lanes: a.lanes,
                                        firstContext: a.firstContext
                                    }), c = c.sibling;
                                    G(M, M.current & 1 | 2);
                                    return b.child;
                                }
                                a = a.sibling;
                            }
                            null !== f.tail && B() > Hj && (b.flags |= 128, d = true, Ej(f, false), b.lanes = 4194304);
                        }
                        else {
                            if (!d) if (a = Mh(g), null !== a) {
                                if (b.flags |= 128, d = true, c = a.updateQueue, null !== c && (b.updateQueue = c, b.flags |= 4), Ej(f, true), null === f.tail && "hidden" === f.tailMode && !g.alternate && !I) return S(b), null;
                            } else 2 * B() - f.renderingStartTime > Hj && 1073741824 !== c && (b.flags |= 128, d = true, Ej(f, false), b.lanes = 4194304);
                            f.isBackwards ? (g.sibling = b.child, b.child = g) : (c = f.last, null !== c ? c.sibling = g : b.child = g, f.last = g);
                        }
                        if (null !== f.tail) return b = f.tail, f.rendering = b, f.tail = b.sibling, f.renderingStartTime = B(), b.sibling = null, c = M.current, G(M, d ? c & 1 | 2 : c & 1), b;
                        S(b);
                        return null;
                    case 22:
                    case 23:
                        return Ij(), d = null !== b.memoizedState, null !== a && null !== a.memoizedState !== d && (b.flags |= 8192), d && 0 !== (b.mode & 1) ? 0 !== (gj & 1073741824) && (S(b), b.subtreeFlags & 6 && (b.flags |= 8192)) : S(b), null;
                    case 24:
                        return null;
                    case 25:
                        return null;
                }
                throw Error(p(156, b.tag));
            }
            function Jj(a, b) {
                wg(b);
                switch(b.tag){
                    case 1:
                        return Zf(b.type) && $f(), a = b.flags, a & 65536 ? (b.flags = a & -65537 | 128, b) : null;
                    case 3:
                        return Jh(), E(Wf), E(H), Oh(), a = b.flags, 0 !== (a & 65536) && 0 === (a & 128) ? (b.flags = a & -65537 | 128, b) : null;
                    case 5:
                        return Lh(b), null;
                    case 13:
                        E(M);
                        a = b.memoizedState;
                        if (null !== a && null !== a.dehydrated) {
                            if (null === b.alternate) throw Error(p(340));
                            Ig();
                        }
                        a = b.flags;
                        return a & 65536 ? (b.flags = a & -65537 | 128, b) : null;
                    case 19:
                        return E(M), null;
                    case 4:
                        return Jh(), null;
                    case 10:
                        return Rg(b.type._context), null;
                    case 22:
                    case 23:
                        return Ij(), null;
                    case 24:
                        return null;
                    default:
                        return null;
                }
            }
            var Kj = false;
            var U = false;
            var Lj = "function" === typeof WeakSet ? WeakSet : Set;
            var V = null;
            function Mj(a, b) {
                var c = a.ref;
                if (null !== c) if ("function" === typeof c) try {
                    c(null);
                } catch (d) {
                    W(a, b, d);
                }
                else c.current = null;
            }
            function Nj(a, b, c) {
                try {
                    c();
                } catch (d) {
                    W(a, b, d);
                }
            }
            var Oj = false;
            function Pj(a, b) {
                Cf = dd;
                a = Me();
                if (Ne(a)) {
                    if ("selectionStart" in a) var c = {
                        start: a.selectionStart,
                        end: a.selectionEnd
                    };
                    else a: {
                        c = (c = a.ownerDocument) && c.defaultView || window;
                        var d = c.getSelection && c.getSelection();
                        if (d && 0 !== d.rangeCount) {
                            c = d.anchorNode;
                            var e = d.anchorOffset, f = d.focusNode;
                            d = d.focusOffset;
                            try {
                                c.nodeType, f.nodeType;
                            } catch (F) {
                                c = null;
                                break a;
                            }
                            var g = 0, h = -1, k = -1, l = 0, m = 0, q = a, r = null;
                            b: for(;;){
                                for(var y;;){
                                    q !== c || 0 !== e && 3 !== q.nodeType || (h = g + e);
                                    q !== f || 0 !== d && 3 !== q.nodeType || (k = g + d);
                                    3 === q.nodeType && (g += q.nodeValue.length);
                                    if (null === (y = q.firstChild)) break;
                                    r = q;
                                    q = y;
                                }
                                for(;;){
                                    if (q === a) break b;
                                    r === c && ++l === e && (h = g);
                                    r === f && ++m === d && (k = g);
                                    if (null !== (y = q.nextSibling)) break;
                                    q = r;
                                    r = q.parentNode;
                                }
                                q = y;
                            }
                            c = -1 === h || -1 === k ? null : {
                                start: h,
                                end: k
                            };
                        } else c = null;
                    }
                    c = c || {
                        start: 0,
                        end: 0
                    };
                } else c = null;
                Df = {
                    focusedElem: a,
                    selectionRange: c
                };
                dd = false;
                for(V = b; null !== V;)if (b = V, a = b.child, 0 !== (b.subtreeFlags & 1028) && null !== a) a.return = b, V = a;
                else for(; null !== V;){
                    b = V;
                    try {
                        var n = b.alternate;
                        if (0 !== (b.flags & 1024)) switch(b.tag){
                            case 0:
                            case 11:
                            case 15:
                                break;
                            case 1:
                                if (null !== n) {
                                    var t = n.memoizedProps, J = n.memoizedState, x = b.stateNode, w = x.getSnapshotBeforeUpdate(b.elementType === b.type ? t : Lg(b.type, t), J);
                                    x.__reactInternalSnapshotBeforeUpdate = w;
                                }
                                break;
                            case 3:
                                var u = b.stateNode.containerInfo;
                                1 === u.nodeType ? u.textContent = "" : 9 === u.nodeType && u.documentElement && u.removeChild(u.documentElement);
                                break;
                            case 5:
                            case 6:
                            case 4:
                            case 17:
                                break;
                            default:
                                throw Error(p(163));
                        }
                    } catch (F) {
                        W(b, b.return, F);
                    }
                    a = b.sibling;
                    if (null !== a) {
                        a.return = b.return;
                        V = a;
                        break;
                    }
                    V = b.return;
                }
                n = Oj;
                Oj = false;
                return n;
            }
            function Qj(a, b, c) {
                var d = b.updateQueue;
                d = null !== d ? d.lastEffect : null;
                if (null !== d) {
                    var e = d = d.next;
                    do {
                        if ((e.tag & a) === a) {
                            var f = e.destroy;
                            e.destroy = void 0;
                            void 0 !== f && Nj(b, c, f);
                        }
                        e = e.next;
                    }while (e !== d)
                }
            }
            function Rj(a, b) {
                b = b.updateQueue;
                b = null !== b ? b.lastEffect : null;
                if (null !== b) {
                    var c = b = b.next;
                    do {
                        if ((c.tag & a) === a) {
                            var d = c.create;
                            c.destroy = d();
                        }
                        c = c.next;
                    }while (c !== b)
                }
            }
            function Sj(a) {
                var b = a.ref;
                if (null !== b) {
                    var c = a.stateNode;
                    switch(a.tag){
                        case 5:
                            a = c;
                            break;
                        default:
                            a = c;
                    }
                    "function" === typeof b ? b(a) : b.current = a;
                }
            }
            function Tj(a) {
                var b = a.alternate;
                null !== b && (a.alternate = null, Tj(b));
                a.child = null;
                a.deletions = null;
                a.sibling = null;
                5 === a.tag && (b = a.stateNode, null !== b && (delete b[Of], delete b[Pf], delete b[of], delete b[Qf], delete b[Rf]));
                a.stateNode = null;
                a.return = null;
                a.dependencies = null;
                a.memoizedProps = null;
                a.memoizedState = null;
                a.pendingProps = null;
                a.stateNode = null;
                a.updateQueue = null;
            }
            function Uj(a) {
                return 5 === a.tag || 3 === a.tag || 4 === a.tag;
            }
            function Vj(a) {
                a: for(;;){
                    for(; null === a.sibling;){
                        if (null === a.return || Uj(a.return)) return null;
                        a = a.return;
                    }
                    a.sibling.return = a.return;
                    for(a = a.sibling; 5 !== a.tag && 6 !== a.tag && 18 !== a.tag;){
                        if (a.flags & 2) continue a;
                        if (null === a.child || 4 === a.tag) continue a;
                        else a.child.return = a, a = a.child;
                    }
                    if (!(a.flags & 2)) return a.stateNode;
                }
            }
            function Wj(a, b, c) {
                var d = a.tag;
                if (5 === d || 6 === d) a = a.stateNode, b ? 8 === c.nodeType ? c.parentNode.insertBefore(a, b) : c.insertBefore(a, b) : (8 === c.nodeType ? (b = c.parentNode, b.insertBefore(a, c)) : (b = c, b.appendChild(a)), c = c._reactRootContainer, null !== c && void 0 !== c || null !== b.onclick || (b.onclick = Bf));
                else if (4 !== d && (a = a.child, null !== a)) for(Wj(a, b, c), a = a.sibling; null !== a;)Wj(a, b, c), a = a.sibling;
            }
            function Xj(a, b, c) {
                var d = a.tag;
                if (5 === d || 6 === d) a = a.stateNode, b ? c.insertBefore(a, b) : c.appendChild(a);
                else if (4 !== d && (a = a.child, null !== a)) for(Xj(a, b, c), a = a.sibling; null !== a;)Xj(a, b, c), a = a.sibling;
            }
            var X = null;
            var Yj = false;
            function Zj(a, b, c) {
                for(c = c.child; null !== c;)ak(a, b, c), c = c.sibling;
            }
            function ak(a, b, c) {
                if (lc && "function" === typeof lc.onCommitFiberUnmount) try {
                    lc.onCommitFiberUnmount(kc, c);
                } catch (h) {}
                switch(c.tag){
                    case 5:
                        U || Mj(c, b);
                    case 6:
                        var d = X, e = Yj;
                        X = null;
                        Zj(a, b, c);
                        X = d;
                        Yj = e;
                        null !== X && (Yj ? (a = X, c = c.stateNode, 8 === a.nodeType ? a.parentNode.removeChild(c) : a.removeChild(c)) : X.removeChild(c.stateNode));
                        break;
                    case 18:
                        null !== X && (Yj ? (a = X, c = c.stateNode, 8 === a.nodeType ? Kf(a.parentNode, c) : 1 === a.nodeType && Kf(a, c), bd(a)) : Kf(X, c.stateNode));
                        break;
                    case 4:
                        d = X;
                        e = Yj;
                        X = c.stateNode.containerInfo;
                        Yj = true;
                        Zj(a, b, c);
                        X = d;
                        Yj = e;
                        break;
                    case 0:
                    case 11:
                    case 14:
                    case 15:
                        if (!U && (d = c.updateQueue, null !== d && (d = d.lastEffect, null !== d))) {
                            e = d = d.next;
                            do {
                                var f = e, g = f.destroy;
                                f = f.tag;
                                void 0 !== g && (0 !== (f & 2) ? Nj(c, b, g) : 0 !== (f & 4) && Nj(c, b, g));
                                e = e.next;
                            }while (e !== d)
                        }
                        Zj(a, b, c);
                        break;
                    case 1:
                        if (!U && (Mj(c, b), d = c.stateNode, "function" === typeof d.componentWillUnmount)) try {
                            d.props = c.memoizedProps, d.state = c.memoizedState, d.componentWillUnmount();
                        } catch (h) {
                            W(c, b, h);
                        }
                        Zj(a, b, c);
                        break;
                    case 21:
                        Zj(a, b, c);
                        break;
                    case 22:
                        c.mode & 1 ? (U = (d = U) || null !== c.memoizedState, Zj(a, b, c), U = d) : Zj(a, b, c);
                        break;
                    default:
                        Zj(a, b, c);
                }
            }
            function bk(a) {
                var b = a.updateQueue;
                if (null !== b) {
                    a.updateQueue = null;
                    var c = a.stateNode;
                    null === c && (c = a.stateNode = new Lj());
                    b.forEach(function(b2) {
                        var d = ck.bind(null, a, b2);
                        c.has(b2) || (c.add(b2), b2.then(d, d));
                    });
                }
            }
            function dk(a, b) {
                var c = b.deletions;
                if (null !== c) for(var d = 0; d < c.length; d++){
                    var e = c[d];
                    try {
                        var f = a, g = b, h = g;
                        a: for(; null !== h;){
                            switch(h.tag){
                                case 5:
                                    X = h.stateNode;
                                    Yj = false;
                                    break a;
                                case 3:
                                    X = h.stateNode.containerInfo;
                                    Yj = true;
                                    break a;
                                case 4:
                                    X = h.stateNode.containerInfo;
                                    Yj = true;
                                    break a;
                            }
                            h = h.return;
                        }
                        if (null === X) throw Error(p(160));
                        ak(f, g, e);
                        X = null;
                        Yj = false;
                        var k = e.alternate;
                        null !== k && (k.return = null);
                        e.return = null;
                    } catch (l) {
                        W(e, b, l);
                    }
                }
                if (b.subtreeFlags & 12854) for(b = b.child; null !== b;)ek(b, a), b = b.sibling;
            }
            function ek(a, b) {
                var c = a.alternate, d = a.flags;
                switch(a.tag){
                    case 0:
                    case 11:
                    case 14:
                    case 15:
                        dk(b, a);
                        fk(a);
                        if (d & 4) {
                            try {
                                Qj(3, a, a.return), Rj(3, a);
                            } catch (t) {
                                W(a, a.return, t);
                            }
                            try {
                                Qj(5, a, a.return);
                            } catch (t) {
                                W(a, a.return, t);
                            }
                        }
                        break;
                    case 1:
                        dk(b, a);
                        fk(a);
                        d & 512 && null !== c && Mj(c, c.return);
                        break;
                    case 5:
                        dk(b, a);
                        fk(a);
                        d & 512 && null !== c && Mj(c, c.return);
                        if (a.flags & 32) {
                            var e = a.stateNode;
                            try {
                                ob(e, "");
                            } catch (t) {
                                W(a, a.return, t);
                            }
                        }
                        if (d & 4 && (e = a.stateNode, null != e)) {
                            var f = a.memoizedProps, g = null !== c ? c.memoizedProps : f, h = a.type, k = a.updateQueue;
                            a.updateQueue = null;
                            if (null !== k) try {
                                "input" === h && "radio" === f.type && null != f.name && ab(e, f);
                                vb(h, g);
                                var l = vb(h, f);
                                for(g = 0; g < k.length; g += 2){
                                    var m = k[g], q = k[g + 1];
                                    "style" === m ? sb(e, q) : "dangerouslySetInnerHTML" === m ? nb(e, q) : "children" === m ? ob(e, q) : ta(e, m, q, l);
                                }
                                switch(h){
                                    case "input":
                                        bb(e, f);
                                        break;
                                    case "textarea":
                                        ib(e, f);
                                        break;
                                    case "select":
                                        var r = e._wrapperState.wasMultiple;
                                        e._wrapperState.wasMultiple = !!f.multiple;
                                        var y = f.value;
                                        null != y ? fb(e, !!f.multiple, y, false) : r !== !!f.multiple && (null != f.defaultValue ? fb(e, !!f.multiple, f.defaultValue, true) : fb(e, !!f.multiple, f.multiple ? [] : "", false));
                                }
                                e[Pf] = f;
                            } catch (t) {
                                W(a, a.return, t);
                            }
                        }
                        break;
                    case 6:
                        dk(b, a);
                        fk(a);
                        if (d & 4) {
                            if (null === a.stateNode) throw Error(p(162));
                            e = a.stateNode;
                            f = a.memoizedProps;
                            try {
                                e.nodeValue = f;
                            } catch (t) {
                                W(a, a.return, t);
                            }
                        }
                        break;
                    case 3:
                        dk(b, a);
                        fk(a);
                        if (d & 4 && null !== c && c.memoizedState.isDehydrated) try {
                            bd(b.containerInfo);
                        } catch (t) {
                            W(a, a.return, t);
                        }
                        break;
                    case 4:
                        dk(b, a);
                        fk(a);
                        break;
                    case 13:
                        dk(b, a);
                        fk(a);
                        e = a.child;
                        e.flags & 8192 && (f = null !== e.memoizedState, e.stateNode.isHidden = f, !f || null !== e.alternate && null !== e.alternate.memoizedState || (gk = B()));
                        d & 4 && bk(a);
                        break;
                    case 22:
                        m = null !== c && null !== c.memoizedState;
                        a.mode & 1 ? (U = (l = U) || m, dk(b, a), U = l) : dk(b, a);
                        fk(a);
                        if (d & 8192) {
                            l = null !== a.memoizedState;
                            if ((a.stateNode.isHidden = l) && !m && 0 !== (a.mode & 1)) for(V = a, m = a.child; null !== m;){
                                for(q = V = m; null !== V;){
                                    r = V;
                                    y = r.child;
                                    switch(r.tag){
                                        case 0:
                                        case 11:
                                        case 14:
                                        case 15:
                                            Qj(4, r, r.return);
                                            break;
                                        case 1:
                                            Mj(r, r.return);
                                            var n = r.stateNode;
                                            if ("function" === typeof n.componentWillUnmount) {
                                                d = r;
                                                c = r.return;
                                                try {
                                                    b = d, n.props = b.memoizedProps, n.state = b.memoizedState, n.componentWillUnmount();
                                                } catch (t) {
                                                    W(d, c, t);
                                                }
                                            }
                                            break;
                                        case 5:
                                            Mj(r, r.return);
                                            break;
                                        case 22:
                                            if (null !== r.memoizedState) {
                                                hk(q);
                                                continue;
                                            }
                                    }
                                    null !== y ? (y.return = r, V = y) : hk(q);
                                }
                                m = m.sibling;
                            }
                            a: for(m = null, q = a;;){
                                if (5 === q.tag) {
                                    if (null === m) {
                                        m = q;
                                        try {
                                            e = q.stateNode, l ? (f = e.style, "function" === typeof f.setProperty ? f.setProperty("display", "none", "important") : f.display = "none") : (h = q.stateNode, k = q.memoizedProps.style, g = void 0 !== k && null !== k && k.hasOwnProperty("display") ? k.display : null, h.style.display = rb("display", g));
                                        } catch (t) {
                                            W(a, a.return, t);
                                        }
                                    }
                                } else if (6 === q.tag) {
                                    if (null === m) try {
                                        q.stateNode.nodeValue = l ? "" : q.memoizedProps;
                                    } catch (t) {
                                        W(a, a.return, t);
                                    }
                                } else if ((22 !== q.tag && 23 !== q.tag || null === q.memoizedState || q === a) && null !== q.child) {
                                    q.child.return = q;
                                    q = q.child;
                                    continue;
                                }
                                if (q === a) break a;
                                for(; null === q.sibling;){
                                    if (null === q.return || q.return === a) break a;
                                    m === q && (m = null);
                                    q = q.return;
                                }
                                m === q && (m = null);
                                q.sibling.return = q.return;
                                q = q.sibling;
                            }
                        }
                        break;
                    case 19:
                        dk(b, a);
                        fk(a);
                        d & 4 && bk(a);
                        break;
                    case 21:
                        break;
                    default:
                        dk(b, a), fk(a);
                }
            }
            function fk(a) {
                var b = a.flags;
                if (b & 2) {
                    try {
                        a: {
                            for(var c = a.return; null !== c;){
                                if (Uj(c)) {
                                    var d = c;
                                    break a;
                                }
                                c = c.return;
                            }
                            throw Error(p(160));
                        }
                        switch(d.tag){
                            case 5:
                                var e = d.stateNode;
                                d.flags & 32 && (ob(e, ""), d.flags &= -33);
                                var f = Vj(a);
                                Xj(a, f, e);
                                break;
                            case 3:
                            case 4:
                                var g = d.stateNode.containerInfo, h = Vj(a);
                                Wj(a, h, g);
                                break;
                            default:
                                throw Error(p(161));
                        }
                    } catch (k) {
                        W(a, a.return, k);
                    }
                    a.flags &= -3;
                }
                b & 4096 && (a.flags &= -4097);
            }
            function ik(a, b, c) {
                V = a;
                jk(a, b, c);
            }
            function jk(a, b, c) {
                for(var d = 0 !== (a.mode & 1); null !== V;){
                    var e = V, f = e.child;
                    if (22 === e.tag && d) {
                        var g = null !== e.memoizedState || Kj;
                        if (!g) {
                            var h = e.alternate, k = null !== h && null !== h.memoizedState || U;
                            h = Kj;
                            var l = U;
                            Kj = g;
                            if ((U = k) && !l) for(V = e; null !== V;)g = V, k = g.child, 22 === g.tag && null !== g.memoizedState ? kk(e) : null !== k ? (k.return = g, V = k) : kk(e);
                            for(; null !== f;)V = f, jk(f, b, c), f = f.sibling;
                            V = e;
                            Kj = h;
                            U = l;
                        }
                        lk(a, b, c);
                    } else 0 !== (e.subtreeFlags & 8772) && null !== f ? (f.return = e, V = f) : lk(a, b, c);
                }
            }
            function lk(a) {
                for(; null !== V;){
                    var b = V;
                    if (0 !== (b.flags & 8772)) {
                        var c = b.alternate;
                        try {
                            if (0 !== (b.flags & 8772)) switch(b.tag){
                                case 0:
                                case 11:
                                case 15:
                                    U || Rj(5, b);
                                    break;
                                case 1:
                                    var d = b.stateNode;
                                    if (b.flags & 4 && !U) if (null === c) d.componentDidMount();
                                    else {
                                        var e = b.elementType === b.type ? c.memoizedProps : Lg(b.type, c.memoizedProps);
                                        d.componentDidUpdate(e, c.memoizedState, d.__reactInternalSnapshotBeforeUpdate);
                                    }
                                    var f = b.updateQueue;
                                    null !== f && ih(b, f, d);
                                    break;
                                case 3:
                                    var g = b.updateQueue;
                                    if (null !== g) {
                                        c = null;
                                        if (null !== b.child) switch(b.child.tag){
                                            case 5:
                                                c = b.child.stateNode;
                                                break;
                                            case 1:
                                                c = b.child.stateNode;
                                        }
                                        ih(b, g, c);
                                    }
                                    break;
                                case 5:
                                    var h = b.stateNode;
                                    if (null === c && b.flags & 4) {
                                        c = h;
                                        var k = b.memoizedProps;
                                        switch(b.type){
                                            case "button":
                                            case "input":
                                            case "select":
                                            case "textarea":
                                                k.autoFocus && c.focus();
                                                break;
                                            case "img":
                                                k.src && (c.src = k.src);
                                        }
                                    }
                                    break;
                                case 6:
                                    break;
                                case 4:
                                    break;
                                case 12:
                                    break;
                                case 13:
                                    if (null === b.memoizedState) {
                                        var l = b.alternate;
                                        if (null !== l) {
                                            var m = l.memoizedState;
                                            if (null !== m) {
                                                var q = m.dehydrated;
                                                null !== q && bd(q);
                                            }
                                        }
                                    }
                                    break;
                                case 19:
                                case 17:
                                case 21:
                                case 22:
                                case 23:
                                case 25:
                                    break;
                                default:
                                    throw Error(p(163));
                            }
                            U || b.flags & 512 && Sj(b);
                        } catch (r) {
                            W(b, b.return, r);
                        }
                    }
                    if (b === a) {
                        V = null;
                        break;
                    }
                    c = b.sibling;
                    if (null !== c) {
                        c.return = b.return;
                        V = c;
                        break;
                    }
                    V = b.return;
                }
            }
            function hk(a) {
                for(; null !== V;){
                    var b = V;
                    if (b === a) {
                        V = null;
                        break;
                    }
                    var c = b.sibling;
                    if (null !== c) {
                        c.return = b.return;
                        V = c;
                        break;
                    }
                    V = b.return;
                }
            }
            function kk(a) {
                for(; null !== V;){
                    var b = V;
                    try {
                        switch(b.tag){
                            case 0:
                            case 11:
                            case 15:
                                var c = b.return;
                                try {
                                    Rj(4, b);
                                } catch (k) {
                                    W(b, c, k);
                                }
                                break;
                            case 1:
                                var d = b.stateNode;
                                if ("function" === typeof d.componentDidMount) {
                                    var e = b.return;
                                    try {
                                        d.componentDidMount();
                                    } catch (k) {
                                        W(b, e, k);
                                    }
                                }
                                var f = b.return;
                                try {
                                    Sj(b);
                                } catch (k) {
                                    W(b, f, k);
                                }
                                break;
                            case 5:
                                var g = b.return;
                                try {
                                    Sj(b);
                                } catch (k) {
                                    W(b, g, k);
                                }
                        }
                    } catch (k) {
                        W(b, b.return, k);
                    }
                    if (b === a) {
                        V = null;
                        break;
                    }
                    var h = b.sibling;
                    if (null !== h) {
                        h.return = b.return;
                        V = h;
                        break;
                    }
                    V = b.return;
                }
            }
            var mk = Math.ceil;
            var nk = ua.ReactCurrentDispatcher;
            var ok = ua.ReactCurrentOwner;
            var pk = ua.ReactCurrentBatchConfig;
            var K = 0;
            var R = null;
            var Y = null;
            var Z = 0;
            var gj = 0;
            var fj = Uf(0);
            var T = 0;
            var qk = null;
            var hh = 0;
            var rk = 0;
            var sk = 0;
            var tk = null;
            var uk = null;
            var gk = 0;
            var Hj = Infinity;
            var vk = null;
            var Pi = false;
            var Qi = null;
            var Si = null;
            var wk = false;
            var xk = null;
            var yk = 0;
            var zk = 0;
            var Ak = null;
            var Bk = -1;
            var Ck = 0;
            function L() {
                return 0 !== (K & 6) ? B() : -1 !== Bk ? Bk : Bk = B();
            }
            function lh(a) {
                if (0 === (a.mode & 1)) return 1;
                if (0 !== (K & 2) && 0 !== Z) return Z & -Z;
                if (null !== Kg.transition) return 0 === Ck && (Ck = yc()), Ck;
                a = C;
                if (0 !== a) return a;
                a = window.event;
                a = void 0 === a ? 16 : jd(a.type);
                return a;
            }
            function mh(a, b, c, d) {
                if (50 < zk) throw zk = 0, Ak = null, Error(p(185));
                Ac(a, c, d);
                if (0 === (K & 2) || a !== R) a === R && (0 === (K & 2) && (rk |= c), 4 === T && Dk(a, Z)), Ek(a, d), 1 === c && 0 === K && 0 === (b.mode & 1) && (Hj = B() + 500, fg && jg());
            }
            function Ek(a, b) {
                var c = a.callbackNode;
                wc(a, b);
                var d = uc(a, a === R ? Z : 0);
                if (0 === d) null !== c && bc(c), a.callbackNode = null, a.callbackPriority = 0;
                else if (b = d & -d, a.callbackPriority !== b) {
                    null != c && bc(c);
                    if (1 === b) 0 === a.tag ? ig(Fk.bind(null, a)) : hg(Fk.bind(null, a)), Jf(function() {
                        0 === (K & 6) && jg();
                    }), c = null;
                    else {
                        switch(Dc(d)){
                            case 1:
                                c = fc;
                                break;
                            case 4:
                                c = gc;
                                break;
                            case 16:
                                c = hc;
                                break;
                            case 536870912:
                                c = jc;
                                break;
                            default:
                                c = hc;
                        }
                        c = Gk(c, Hk.bind(null, a));
                    }
                    a.callbackPriority = b;
                    a.callbackNode = c;
                }
            }
            function Hk(a, b) {
                Bk = -1;
                Ck = 0;
                if (0 !== (K & 6)) throw Error(p(327));
                var c = a.callbackNode;
                if (Ik() && a.callbackNode !== c) return null;
                var d = uc(a, a === R ? Z : 0);
                if (0 === d) return null;
                if (0 !== (d & 30) || 0 !== (d & a.expiredLanes) || b) b = Jk(a, d);
                else {
                    b = d;
                    var e = K;
                    K |= 2;
                    var f = Kk();
                    if (R !== a || Z !== b) vk = null, Hj = B() + 500, Lk(a, b);
                    do try {
                        Mk();
                        break;
                    } catch (h) {
                        Nk(a, h);
                    }
                    while (1)
                    Qg();
                    nk.current = f;
                    K = e;
                    null !== Y ? b = 0 : (R = null, Z = 0, b = T);
                }
                if (0 !== b) {
                    2 === b && (e = xc(a), 0 !== e && (d = e, b = Ok(a, e)));
                    if (1 === b) throw c = qk, Lk(a, 0), Dk(a, d), Ek(a, B()), c;
                    if (6 === b) Dk(a, d);
                    else {
                        e = a.current.alternate;
                        if (0 === (d & 30) && !Pk(e) && (b = Jk(a, d), 2 === b && (f = xc(a), 0 !== f && (d = f, b = Ok(a, f))), 1 === b)) throw c = qk, Lk(a, 0), Dk(a, d), Ek(a, B()), c;
                        a.finishedWork = e;
                        a.finishedLanes = d;
                        switch(b){
                            case 0:
                            case 1:
                                throw Error(p(345));
                            case 2:
                                Qk(a, uk, vk);
                                break;
                            case 3:
                                Dk(a, d);
                                if ((d & 130023424) === d && (b = gk + 500 - B(), 10 < b)) {
                                    if (0 !== uc(a, 0)) break;
                                    e = a.suspendedLanes;
                                    if ((e & d) !== d) {
                                        L();
                                        a.pingedLanes |= a.suspendedLanes & e;
                                        break;
                                    }
                                    a.timeoutHandle = Ff(Qk.bind(null, a, uk, vk), b);
                                    break;
                                }
                                Qk(a, uk, vk);
                                break;
                            case 4:
                                Dk(a, d);
                                if ((d & 4194240) === d) break;
                                b = a.eventTimes;
                                for(e = -1; 0 < d;){
                                    var g = 31 - oc(d);
                                    f = 1 << g;
                                    g = b[g];
                                    g > e && (e = g);
                                    d &= ~f;
                                }
                                d = e;
                                d = B() - d;
                                d = (120 > d ? 120 : 480 > d ? 480 : 1080 > d ? 1080 : 1920 > d ? 1920 : 3e3 > d ? 3e3 : 4320 > d ? 4320 : 1960 * mk(d / 1960)) - d;
                                if (10 < d) {
                                    a.timeoutHandle = Ff(Qk.bind(null, a, uk, vk), d);
                                    break;
                                }
                                Qk(a, uk, vk);
                                break;
                            case 5:
                                Qk(a, uk, vk);
                                break;
                            default:
                                throw Error(p(329));
                        }
                    }
                }
                Ek(a, B());
                return a.callbackNode === c ? Hk.bind(null, a) : null;
            }
            function Ok(a, b) {
                var c = tk;
                a.current.memoizedState.isDehydrated && (Lk(a, b).flags |= 256);
                a = Jk(a, b);
                2 !== a && (b = uk, uk = c, null !== b && Gj(b));
                return a;
            }
            function Gj(a) {
                null === uk ? uk = a : uk.push.apply(uk, a);
            }
            function Pk(a) {
                for(var b = a;;){
                    if (b.flags & 16384) {
                        var c = b.updateQueue;
                        if (null !== c && (c = c.stores, null !== c)) for(var d = 0; d < c.length; d++){
                            var e = c[d], f = e.getSnapshot;
                            e = e.value;
                            try {
                                if (!He(f(), e)) return false;
                            } catch (g) {
                                return false;
                            }
                        }
                    }
                    c = b.child;
                    if (b.subtreeFlags & 16384 && null !== c) c.return = b, b = c;
                    else {
                        if (b === a) break;
                        for(; null === b.sibling;){
                            if (null === b.return || b.return === a) return true;
                            b = b.return;
                        }
                        b.sibling.return = b.return;
                        b = b.sibling;
                    }
                }
                return true;
            }
            function Dk(a, b) {
                b &= ~sk;
                b &= ~rk;
                a.suspendedLanes |= b;
                a.pingedLanes &= ~b;
                for(a = a.expirationTimes; 0 < b;){
                    var c = 31 - oc(b), d = 1 << c;
                    a[c] = -1;
                    b &= ~d;
                }
            }
            function Fk(a) {
                if (0 !== (K & 6)) throw Error(p(327));
                Ik();
                var b = uc(a, 0);
                if (0 === (b & 1)) return Ek(a, B()), null;
                var c = Jk(a, b);
                if (0 !== a.tag && 2 === c) {
                    var d = xc(a);
                    0 !== d && (b = d, c = Ok(a, d));
                }
                if (1 === c) throw c = qk, Lk(a, 0), Dk(a, b), Ek(a, B()), c;
                if (6 === c) throw Error(p(345));
                a.finishedWork = a.current.alternate;
                a.finishedLanes = b;
                Qk(a, uk, vk);
                Ek(a, B());
                return null;
            }
            function Rk(a, b) {
                var c = K;
                K |= 1;
                try {
                    return a(b);
                } finally{
                    K = c, 0 === K && (Hj = B() + 500, fg && jg());
                }
            }
            function Sk(a) {
                null !== xk && 0 === xk.tag && 0 === (K & 6) && Ik();
                var b = K;
                K |= 1;
                var c = pk.transition, d = C;
                try {
                    if (pk.transition = null, C = 1, a) return a();
                } finally{
                    C = d, pk.transition = c, K = b, 0 === (K & 6) && jg();
                }
            }
            function Ij() {
                gj = fj.current;
                E(fj);
            }
            function Lk(a, b) {
                a.finishedWork = null;
                a.finishedLanes = 0;
                var c = a.timeoutHandle;
                -1 !== c && (a.timeoutHandle = -1, Gf(c));
                if (null !== Y) for(c = Y.return; null !== c;){
                    var d = c;
                    wg(d);
                    switch(d.tag){
                        case 1:
                            d = d.type.childContextTypes;
                            null !== d && void 0 !== d && $f();
                            break;
                        case 3:
                            Jh();
                            E(Wf);
                            E(H);
                            Oh();
                            break;
                        case 5:
                            Lh(d);
                            break;
                        case 4:
                            Jh();
                            break;
                        case 13:
                            E(M);
                            break;
                        case 19:
                            E(M);
                            break;
                        case 10:
                            Rg(d.type._context);
                            break;
                        case 22:
                        case 23:
                            Ij();
                    }
                    c = c.return;
                }
                R = a;
                Y = a = wh(a.current, null);
                Z = gj = b;
                T = 0;
                qk = null;
                sk = rk = hh = 0;
                uk = tk = null;
                if (null !== Wg) {
                    for(b = 0; b < Wg.length; b++)if (c = Wg[b], d = c.interleaved, null !== d) {
                        c.interleaved = null;
                        var e = d.next, f = c.pending;
                        if (null !== f) {
                            var g = f.next;
                            f.next = e;
                            d.next = g;
                        }
                        c.pending = d;
                    }
                    Wg = null;
                }
                return a;
            }
            function Nk(a, b) {
                do {
                    var c = Y;
                    try {
                        Qg();
                        Ph.current = ai;
                        if (Sh) {
                            for(var d = N.memoizedState; null !== d;){
                                var e = d.queue;
                                null !== e && (e.pending = null);
                                d = d.next;
                            }
                            Sh = false;
                        }
                        Rh = 0;
                        P = O = N = null;
                        Th = false;
                        Uh = 0;
                        ok.current = null;
                        if (null === c || null === c.return) {
                            T = 1;
                            qk = b;
                            Y = null;
                            break;
                        }
                        a: {
                            var f = a, g = c.return, h = c, k = b;
                            b = Z;
                            h.flags |= 32768;
                            if (null !== k && "object" === typeof k && "function" === typeof k.then) {
                                var l = k, m = h, q = m.tag;
                                if (0 === (m.mode & 1) && (0 === q || 11 === q || 15 === q)) {
                                    var r = m.alternate;
                                    r ? (m.updateQueue = r.updateQueue, m.memoizedState = r.memoizedState, m.lanes = r.lanes) : (m.updateQueue = null, m.memoizedState = null);
                                }
                                var y = Vi(g);
                                if (null !== y) {
                                    y.flags &= -257;
                                    Wi(y, g, h, f, b);
                                    y.mode & 1 && Ti(f, l, b);
                                    b = y;
                                    k = l;
                                    var n = b.updateQueue;
                                    if (null === n) {
                                        var t = /* @__PURE__ */ new Set();
                                        t.add(k);
                                        b.updateQueue = t;
                                    } else n.add(k);
                                    break a;
                                } else {
                                    if (0 === (b & 1)) {
                                        Ti(f, l, b);
                                        uj();
                                        break a;
                                    }
                                    k = Error(p(426));
                                }
                            } else if (I && h.mode & 1) {
                                var J = Vi(g);
                                if (null !== J) {
                                    0 === (J.flags & 65536) && (J.flags |= 256);
                                    Wi(J, g, h, f, b);
                                    Jg(Ki(k, h));
                                    break a;
                                }
                            }
                            f = k = Ki(k, h);
                            4 !== T && (T = 2);
                            null === tk ? tk = [
                                f
                            ] : tk.push(f);
                            f = g;
                            do {
                                switch(f.tag){
                                    case 3:
                                        f.flags |= 65536;
                                        b &= -b;
                                        f.lanes |= b;
                                        var x = Oi(f, k, b);
                                        fh(f, x);
                                        break a;
                                    case 1:
                                        h = k;
                                        var w = f.type, u = f.stateNode;
                                        if (0 === (f.flags & 128) && ("function" === typeof w.getDerivedStateFromError || null !== u && "function" === typeof u.componentDidCatch && (null === Si || !Si.has(u)))) {
                                            f.flags |= 65536;
                                            b &= -b;
                                            f.lanes |= b;
                                            var F = Ri(f, h, b);
                                            fh(f, F);
                                            break a;
                                        }
                                }
                                f = f.return;
                            }while (null !== f)
                        }
                        Tk(c);
                    } catch (na) {
                        b = na;
                        Y === c && null !== c && (Y = c = c.return);
                        continue;
                    }
                    break;
                }while (1)
            }
            function Kk() {
                var a = nk.current;
                nk.current = ai;
                return null === a ? ai : a;
            }
            function uj() {
                if (0 === T || 3 === T || 2 === T) T = 4;
                null === R || 0 === (hh & 268435455) && 0 === (rk & 268435455) || Dk(R, Z);
            }
            function Jk(a, b) {
                var c = K;
                K |= 2;
                var d = Kk();
                if (R !== a || Z !== b) vk = null, Lk(a, b);
                do try {
                    Uk();
                    break;
                } catch (e) {
                    Nk(a, e);
                }
                while (1)
                Qg();
                K = c;
                nk.current = d;
                if (null !== Y) throw Error(p(261));
                R = null;
                Z = 0;
                return T;
            }
            function Uk() {
                for(; null !== Y;)Vk(Y);
            }
            function Mk() {
                for(; null !== Y && !cc();)Vk(Y);
            }
            function Vk(a) {
                var b = Wk(a.alternate, a, gj);
                a.memoizedProps = a.pendingProps;
                null === b ? Tk(a) : Y = b;
                ok.current = null;
            }
            function Tk(a) {
                var b = a;
                do {
                    var c = b.alternate;
                    a = b.return;
                    if (0 === (b.flags & 32768)) {
                        if (c = Fj(c, b, gj), null !== c) {
                            Y = c;
                            return;
                        }
                    } else {
                        c = Jj(c, b);
                        if (null !== c) {
                            c.flags &= 32767;
                            Y = c;
                            return;
                        }
                        if (null !== a) a.flags |= 32768, a.subtreeFlags = 0, a.deletions = null;
                        else {
                            T = 6;
                            Y = null;
                            return;
                        }
                    }
                    b = b.sibling;
                    if (null !== b) {
                        Y = b;
                        return;
                    }
                    Y = b = a;
                }while (null !== b)
                0 === T && (T = 5);
            }
            function Qk(a, b, c) {
                var d = C, e = pk.transition;
                try {
                    pk.transition = null, C = 1, Xk(a, b, c, d);
                } finally{
                    pk.transition = e, C = d;
                }
                return null;
            }
            function Xk(a, b, c, d) {
                do Ik();
                while (null !== xk)
                if (0 !== (K & 6)) throw Error(p(327));
                c = a.finishedWork;
                var e = a.finishedLanes;
                if (null === c) return null;
                a.finishedWork = null;
                a.finishedLanes = 0;
                if (c === a.current) throw Error(p(177));
                a.callbackNode = null;
                a.callbackPriority = 0;
                var f = c.lanes | c.childLanes;
                Bc(a, f);
                a === R && (Y = R = null, Z = 0);
                0 === (c.subtreeFlags & 2064) && 0 === (c.flags & 2064) || wk || (wk = true, Gk(hc, function() {
                    Ik();
                    return null;
                }));
                f = 0 !== (c.flags & 15990);
                if (0 !== (c.subtreeFlags & 15990) || f) {
                    f = pk.transition;
                    pk.transition = null;
                    var g = C;
                    C = 1;
                    var h = K;
                    K |= 4;
                    ok.current = null;
                    Pj(a, c);
                    ek(c, a);
                    Oe(Df);
                    dd = !!Cf;
                    Df = Cf = null;
                    a.current = c;
                    ik(c, a, e);
                    dc();
                    K = h;
                    C = g;
                    pk.transition = f;
                } else a.current = c;
                wk && (wk = false, xk = a, yk = e);
                f = a.pendingLanes;
                0 === f && (Si = null);
                mc(c.stateNode, d);
                Ek(a, B());
                if (null !== b) for(d = a.onRecoverableError, c = 0; c < b.length; c++)e = b[c], d(e.value, {
                    componentStack: e.stack,
                    digest: e.digest
                });
                if (Pi) throw Pi = false, a = Qi, Qi = null, a;
                0 !== (yk & 1) && 0 !== a.tag && Ik();
                f = a.pendingLanes;
                0 !== (f & 1) ? a === Ak ? zk++ : (zk = 0, Ak = a) : zk = 0;
                jg();
                return null;
            }
            function Ik() {
                if (null !== xk) {
                    var a = Dc(yk), b = pk.transition, c = C;
                    try {
                        pk.transition = null;
                        C = 16 > a ? 16 : a;
                        if (null === xk) var d = false;
                        else {
                            a = xk;
                            xk = null;
                            yk = 0;
                            if (0 !== (K & 6)) throw Error(p(331));
                            var e = K;
                            K |= 4;
                            for(V = a.current; null !== V;){
                                var f = V, g = f.child;
                                if (0 !== (V.flags & 16)) {
                                    var h = f.deletions;
                                    if (null !== h) {
                                        for(var k = 0; k < h.length; k++){
                                            var l = h[k];
                                            for(V = l; null !== V;){
                                                var m = V;
                                                switch(m.tag){
                                                    case 0:
                                                    case 11:
                                                    case 15:
                                                        Qj(8, m, f);
                                                }
                                                var q = m.child;
                                                if (null !== q) q.return = m, V = q;
                                                else for(; null !== V;){
                                                    m = V;
                                                    var r = m.sibling, y = m.return;
                                                    Tj(m);
                                                    if (m === l) {
                                                        V = null;
                                                        break;
                                                    }
                                                    if (null !== r) {
                                                        r.return = y;
                                                        V = r;
                                                        break;
                                                    }
                                                    V = y;
                                                }
                                            }
                                        }
                                        var n = f.alternate;
                                        if (null !== n) {
                                            var t = n.child;
                                            if (null !== t) {
                                                n.child = null;
                                                do {
                                                    var J = t.sibling;
                                                    t.sibling = null;
                                                    t = J;
                                                }while (null !== t)
                                            }
                                        }
                                        V = f;
                                    }
                                }
                                if (0 !== (f.subtreeFlags & 2064) && null !== g) g.return = f, V = g;
                                else b: for(; null !== V;){
                                    f = V;
                                    if (0 !== (f.flags & 2048)) switch(f.tag){
                                        case 0:
                                        case 11:
                                        case 15:
                                            Qj(9, f, f.return);
                                    }
                                    var x = f.sibling;
                                    if (null !== x) {
                                        x.return = f.return;
                                        V = x;
                                        break b;
                                    }
                                    V = f.return;
                                }
                            }
                            var w = a.current;
                            for(V = w; null !== V;){
                                g = V;
                                var u = g.child;
                                if (0 !== (g.subtreeFlags & 2064) && null !== u) u.return = g, V = u;
                                else b: for(g = w; null !== V;){
                                    h = V;
                                    if (0 !== (h.flags & 2048)) try {
                                        switch(h.tag){
                                            case 0:
                                            case 11:
                                            case 15:
                                                Rj(9, h);
                                        }
                                    } catch (na) {
                                        W(h, h.return, na);
                                    }
                                    if (h === g) {
                                        V = null;
                                        break b;
                                    }
                                    var F = h.sibling;
                                    if (null !== F) {
                                        F.return = h.return;
                                        V = F;
                                        break b;
                                    }
                                    V = h.return;
                                }
                            }
                            K = e;
                            jg();
                            if (lc && "function" === typeof lc.onPostCommitFiberRoot) try {
                                lc.onPostCommitFiberRoot(kc, a);
                            } catch (na) {}
                            d = true;
                        }
                        return d;
                    } finally{
                        C = c, pk.transition = b;
                    }
                }
                return false;
            }
            function Yk(a, b, c) {
                b = Ki(c, b);
                b = Oi(a, b, 1);
                a = dh(a, b, 1);
                b = L();
                null !== a && (Ac(a, 1, b), Ek(a, b));
            }
            function W(a, b, c) {
                if (3 === a.tag) Yk(a, a, c);
                else for(; null !== b;){
                    if (3 === b.tag) {
                        Yk(b, a, c);
                        break;
                    } else if (1 === b.tag) {
                        var d = b.stateNode;
                        if ("function" === typeof b.type.getDerivedStateFromError || "function" === typeof d.componentDidCatch && (null === Si || !Si.has(d))) {
                            a = Ki(c, a);
                            a = Ri(b, a, 1);
                            b = dh(b, a, 1);
                            a = L();
                            null !== b && (Ac(b, 1, a), Ek(b, a));
                            break;
                        }
                    }
                    b = b.return;
                }
            }
            function Ui(a, b, c) {
                var d = a.pingCache;
                null !== d && d.delete(b);
                b = L();
                a.pingedLanes |= a.suspendedLanes & c;
                R === a && (Z & c) === c && (4 === T || 3 === T && (Z & 130023424) === Z && 500 > B() - gk ? Lk(a, 0) : sk |= c);
                Ek(a, b);
            }
            function Zk(a, b) {
                0 === b && (0 === (a.mode & 1) ? b = 1 : (b = sc, sc <<= 1, 0 === (sc & 130023424) && (sc = 4194304)));
                var c = L();
                a = Zg(a, b);
                null !== a && (Ac(a, b, c), Ek(a, c));
            }
            function vj(a) {
                var b = a.memoizedState, c = 0;
                null !== b && (c = b.retryLane);
                Zk(a, c);
            }
            function ck(a, b) {
                var c = 0;
                switch(a.tag){
                    case 13:
                        var d = a.stateNode;
                        var e = a.memoizedState;
                        null !== e && (c = e.retryLane);
                        break;
                    case 19:
                        d = a.stateNode;
                        break;
                    default:
                        throw Error(p(314));
                }
                null !== d && d.delete(b);
                Zk(a, c);
            }
            var Wk;
            Wk = function(a, b, c) {
                if (null !== a) if (a.memoizedProps !== b.pendingProps || Wf.current) Ug = true;
                else {
                    if (0 === (a.lanes & c) && 0 === (b.flags & 128)) return Ug = false, zj(a, b, c);
                    Ug = 0 !== (a.flags & 131072) ? true : false;
                }
                else Ug = false, I && 0 !== (b.flags & 1048576) && ug(b, ng, b.index);
                b.lanes = 0;
                switch(b.tag){
                    case 2:
                        var d = b.type;
                        jj(a, b);
                        a = b.pendingProps;
                        var e = Yf(b, H.current);
                        Tg(b, c);
                        e = Xh(null, b, d, a, e, c);
                        var f = bi();
                        b.flags |= 1;
                        "object" === typeof e && null !== e && "function" === typeof e.render && void 0 === e.$$typeof ? (b.tag = 1, b.memoizedState = null, b.updateQueue = null, Zf(d) ? (f = true, cg(b)) : f = false, b.memoizedState = null !== e.state && void 0 !== e.state ? e.state : null, ah(b), e.updater = nh, b.stateNode = e, e._reactInternals = b, rh(b, d, a, c), b = kj(null, b, d, true, f, c)) : (b.tag = 0, I && f && vg(b), Yi(null, b, e, c), b = b.child);
                        return b;
                    case 16:
                        d = b.elementType;
                        a: {
                            jj(a, b);
                            a = b.pendingProps;
                            e = d._init;
                            d = e(d._payload);
                            b.type = d;
                            e = b.tag = $k(d);
                            a = Lg(d, a);
                            switch(e){
                                case 0:
                                    b = dj(null, b, d, a, c);
                                    break a;
                                case 1:
                                    b = ij(null, b, d, a, c);
                                    break a;
                                case 11:
                                    b = Zi(null, b, d, a, c);
                                    break a;
                                case 14:
                                    b = aj(null, b, d, Lg(d.type, a), c);
                                    break a;
                            }
                            throw Error(p(306, d, ""));
                        }
                        return b;
                    case 0:
                        return d = b.type, e = b.pendingProps, e = b.elementType === d ? e : Lg(d, e), dj(a, b, d, e, c);
                    case 1:
                        return d = b.type, e = b.pendingProps, e = b.elementType === d ? e : Lg(d, e), ij(a, b, d, e, c);
                    case 3:
                        a: {
                            lj(b);
                            if (null === a) throw Error(p(387));
                            d = b.pendingProps;
                            f = b.memoizedState;
                            e = f.element;
                            bh(a, b);
                            gh(b, d, null, c);
                            var g = b.memoizedState;
                            d = g.element;
                            if (f.isDehydrated) if (f = {
                                element: d,
                                isDehydrated: false,
                                cache: g.cache,
                                pendingSuspenseBoundaries: g.pendingSuspenseBoundaries,
                                transitions: g.transitions
                            }, b.updateQueue.baseState = f, b.memoizedState = f, b.flags & 256) {
                                e = Ki(Error(p(423)), b);
                                b = mj(a, b, d, c, e);
                                break a;
                            } else if (d !== e) {
                                e = Ki(Error(p(424)), b);
                                b = mj(a, b, d, c, e);
                                break a;
                            } else for(yg = Lf(b.stateNode.containerInfo.firstChild), xg = b, I = true, zg = null, c = Ch(b, null, d, c), b.child = c; c;)c.flags = c.flags & -3 | 4096, c = c.sibling;
                            else {
                                Ig();
                                if (d === e) {
                                    b = $i(a, b, c);
                                    break a;
                                }
                                Yi(a, b, d, c);
                            }
                            b = b.child;
                        }
                        return b;
                    case 5:
                        return Kh(b), null === a && Eg(b), d = b.type, e = b.pendingProps, f = null !== a ? a.memoizedProps : null, g = e.children, Ef(d, e) ? g = null : null !== f && Ef(d, f) && (b.flags |= 32), hj(a, b), Yi(a, b, g, c), b.child;
                    case 6:
                        return null === a && Eg(b), null;
                    case 13:
                        return pj(a, b, c);
                    case 4:
                        return Ih(b, b.stateNode.containerInfo), d = b.pendingProps, null === a ? b.child = Bh(b, null, d, c) : Yi(a, b, d, c), b.child;
                    case 11:
                        return d = b.type, e = b.pendingProps, e = b.elementType === d ? e : Lg(d, e), Zi(a, b, d, e, c);
                    case 7:
                        return Yi(a, b, b.pendingProps, c), b.child;
                    case 8:
                        return Yi(a, b, b.pendingProps.children, c), b.child;
                    case 12:
                        return Yi(a, b, b.pendingProps.children, c), b.child;
                    case 10:
                        a: {
                            d = b.type._context;
                            e = b.pendingProps;
                            f = b.memoizedProps;
                            g = e.value;
                            G(Mg, d._currentValue);
                            d._currentValue = g;
                            if (null !== f) if (He(f.value, g)) {
                                if (f.children === e.children && !Wf.current) {
                                    b = $i(a, b, c);
                                    break a;
                                }
                            } else for(f = b.child, null !== f && (f.return = b); null !== f;){
                                var h = f.dependencies;
                                if (null !== h) {
                                    g = f.child;
                                    for(var k = h.firstContext; null !== k;){
                                        if (k.context === d) {
                                            if (1 === f.tag) {
                                                k = ch(-1, c & -c);
                                                k.tag = 2;
                                                var l = f.updateQueue;
                                                if (null !== l) {
                                                    l = l.shared;
                                                    var m = l.pending;
                                                    null === m ? k.next = k : (k.next = m.next, m.next = k);
                                                    l.pending = k;
                                                }
                                            }
                                            f.lanes |= c;
                                            k = f.alternate;
                                            null !== k && (k.lanes |= c);
                                            Sg(f.return, c, b);
                                            h.lanes |= c;
                                            break;
                                        }
                                        k = k.next;
                                    }
                                } else if (10 === f.tag) g = f.type === b.type ? null : f.child;
                                else if (18 === f.tag) {
                                    g = f.return;
                                    if (null === g) throw Error(p(341));
                                    g.lanes |= c;
                                    h = g.alternate;
                                    null !== h && (h.lanes |= c);
                                    Sg(g, c, b);
                                    g = f.sibling;
                                } else g = f.child;
                                if (null !== g) g.return = f;
                                else for(g = f; null !== g;){
                                    if (g === b) {
                                        g = null;
                                        break;
                                    }
                                    f = g.sibling;
                                    if (null !== f) {
                                        f.return = g.return;
                                        g = f;
                                        break;
                                    }
                                    g = g.return;
                                }
                                f = g;
                            }
                            Yi(a, b, e.children, c);
                            b = b.child;
                        }
                        return b;
                    case 9:
                        return e = b.type, d = b.pendingProps.children, Tg(b, c), e = Vg(e), d = d(e), b.flags |= 1, Yi(a, b, d, c), b.child;
                    case 14:
                        return d = b.type, e = Lg(d, b.pendingProps), e = Lg(d.type, e), aj(a, b, d, e, c);
                    case 15:
                        return cj(a, b, b.type, b.pendingProps, c);
                    case 17:
                        return d = b.type, e = b.pendingProps, e = b.elementType === d ? e : Lg(d, e), jj(a, b), b.tag = 1, Zf(d) ? (a = true, cg(b)) : a = false, Tg(b, c), ph(b, d, e), rh(b, d, e, c), kj(null, b, d, true, a, c);
                    case 19:
                        return yj(a, b, c);
                    case 22:
                        return ej(a, b, c);
                }
                throw Error(p(156, b.tag));
            };
            function Gk(a, b) {
                return ac(a, b);
            }
            function al(a, b, c, d) {
                this.tag = a;
                this.key = c;
                this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null;
                this.index = 0;
                this.ref = null;
                this.pendingProps = b;
                this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null;
                this.mode = d;
                this.subtreeFlags = this.flags = 0;
                this.deletions = null;
                this.childLanes = this.lanes = 0;
                this.alternate = null;
            }
            function Bg(a, b, c, d) {
                return new al(a, b, c, d);
            }
            function bj(a) {
                a = a.prototype;
                return !(!a || !a.isReactComponent);
            }
            function $k(a) {
                if ("function" === typeof a) return bj(a) ? 1 : 0;
                if (void 0 !== a && null !== a) {
                    a = a.$$typeof;
                    if (a === Da) return 11;
                    if (a === Ga) return 14;
                }
                return 2;
            }
            function wh(a, b) {
                var c = a.alternate;
                null === c ? (c = Bg(a.tag, b, a.key, a.mode), c.elementType = a.elementType, c.type = a.type, c.stateNode = a.stateNode, c.alternate = a, a.alternate = c) : (c.pendingProps = b, c.type = a.type, c.flags = 0, c.subtreeFlags = 0, c.deletions = null);
                c.flags = a.flags & 14680064;
                c.childLanes = a.childLanes;
                c.lanes = a.lanes;
                c.child = a.child;
                c.memoizedProps = a.memoizedProps;
                c.memoizedState = a.memoizedState;
                c.updateQueue = a.updateQueue;
                b = a.dependencies;
                c.dependencies = null === b ? null : {
                    lanes: b.lanes,
                    firstContext: b.firstContext
                };
                c.sibling = a.sibling;
                c.index = a.index;
                c.ref = a.ref;
                return c;
            }
            function yh(a, b, c, d, e, f) {
                var g = 2;
                d = a;
                if ("function" === typeof a) bj(a) && (g = 1);
                else if ("string" === typeof a) g = 5;
                else a: switch(a){
                    case ya:
                        return Ah(c.children, e, f, b);
                    case za:
                        g = 8;
                        e |= 8;
                        break;
                    case Aa:
                        return a = Bg(12, c, b, e | 2), a.elementType = Aa, a.lanes = f, a;
                    case Ea:
                        return a = Bg(13, c, b, e), a.elementType = Ea, a.lanes = f, a;
                    case Fa:
                        return a = Bg(19, c, b, e), a.elementType = Fa, a.lanes = f, a;
                    case Ia:
                        return qj(c, e, f, b);
                    default:
                        if ("object" === typeof a && null !== a) switch(a.$$typeof){
                            case Ba:
                                g = 10;
                                break a;
                            case Ca:
                                g = 9;
                                break a;
                            case Da:
                                g = 11;
                                break a;
                            case Ga:
                                g = 14;
                                break a;
                            case Ha:
                                g = 16;
                                d = null;
                                break a;
                        }
                        throw Error(p(130, null == a ? a : typeof a, ""));
                }
                b = Bg(g, c, b, e);
                b.elementType = a;
                b.type = d;
                b.lanes = f;
                return b;
            }
            function Ah(a, b, c, d) {
                a = Bg(7, a, d, b);
                a.lanes = c;
                return a;
            }
            function qj(a, b, c, d) {
                a = Bg(22, a, d, b);
                a.elementType = Ia;
                a.lanes = c;
                a.stateNode = {
                    isHidden: false
                };
                return a;
            }
            function xh(a, b, c) {
                a = Bg(6, a, null, b);
                a.lanes = c;
                return a;
            }
            function zh(a, b, c) {
                b = Bg(4, null !== a.children ? a.children : [], a.key, b);
                b.lanes = c;
                b.stateNode = {
                    containerInfo: a.containerInfo,
                    pendingChildren: null,
                    implementation: a.implementation
                };
                return b;
            }
            function bl(a, b, c, d, e) {
                this.tag = b;
                this.containerInfo = a;
                this.finishedWork = this.pingCache = this.current = this.pendingChildren = null;
                this.timeoutHandle = -1;
                this.callbackNode = this.pendingContext = this.context = null;
                this.callbackPriority = 0;
                this.eventTimes = zc(0);
                this.expirationTimes = zc(-1);
                this.entangledLanes = this.finishedLanes = this.mutableReadLanes = this.expiredLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0;
                this.entanglements = zc(0);
                this.identifierPrefix = d;
                this.onRecoverableError = e;
                this.mutableSourceEagerHydrationData = null;
            }
            function cl(a, b, c, d, e, f, g, h, k) {
                a = new bl(a, b, c, h, k);
                1 === b ? (b = 1, true === f && (b |= 8)) : b = 0;
                f = Bg(3, null, null, b);
                a.current = f;
                f.stateNode = a;
                f.memoizedState = {
                    element: d,
                    isDehydrated: c,
                    cache: null,
                    transitions: null,
                    pendingSuspenseBoundaries: null
                };
                ah(f);
                return a;
            }
            function dl(a, b, c) {
                var d = 3 < arguments.length && void 0 !== arguments[3] ? arguments[3] : null;
                return {
                    $$typeof: wa,
                    key: null == d ? null : "" + d,
                    children: a,
                    containerInfo: b,
                    implementation: c
                };
            }
            function el(a) {
                if (!a) return Vf;
                a = a._reactInternals;
                a: {
                    if (Vb(a) !== a || 1 !== a.tag) throw Error(p(170));
                    var b = a;
                    do {
                        switch(b.tag){
                            case 3:
                                b = b.stateNode.context;
                                break a;
                            case 1:
                                if (Zf(b.type)) {
                                    b = b.stateNode.__reactInternalMemoizedMergedChildContext;
                                    break a;
                                }
                        }
                        b = b.return;
                    }while (null !== b)
                    throw Error(p(171));
                }
                if (1 === a.tag) {
                    var c = a.type;
                    if (Zf(c)) return bg(a, c, b);
                }
                return b;
            }
            function fl(a, b, c, d, e, f, g, h, k) {
                a = cl(c, d, true, a, e, f, g, h, k);
                a.context = el(null);
                c = a.current;
                d = L();
                e = lh(c);
                f = ch(d, e);
                f.callback = void 0 !== b && null !== b ? b : null;
                dh(c, f, e);
                a.current.lanes = e;
                Ac(a, e, d);
                Ek(a, d);
                return a;
            }
            function gl(a, b, c, d) {
                var e = b.current, f = L(), g = lh(e);
                c = el(c);
                null === b.context ? b.context = c : b.pendingContext = c;
                b = ch(f, g);
                b.payload = {
                    element: a
                };
                d = void 0 === d ? null : d;
                null !== d && (b.callback = d);
                a = dh(e, b, g);
                null !== a && (mh(a, e, g, f), eh(a, e, g));
                return g;
            }
            function hl(a) {
                a = a.current;
                if (!a.child) return null;
                switch(a.child.tag){
                    case 5:
                        return a.child.stateNode;
                    default:
                        return a.child.stateNode;
                }
            }
            function il(a, b) {
                a = a.memoizedState;
                if (null !== a && null !== a.dehydrated) {
                    var c = a.retryLane;
                    a.retryLane = 0 !== c && c < b ? c : b;
                }
            }
            function jl(a, b) {
                il(a, b);
                (a = a.alternate) && il(a, b);
            }
            function kl() {
                return null;
            }
            var ll = "function" === typeof reportError ? reportError : function(a) {
                console.error(a);
            };
            function ml(a) {
                this._internalRoot = a;
            }
            nl.prototype.render = ml.prototype.render = function(a) {
                var b = this._internalRoot;
                if (null === b) throw Error(p(409));
                gl(a, b, null, null);
            };
            nl.prototype.unmount = ml.prototype.unmount = function() {
                var a = this._internalRoot;
                if (null !== a) {
                    this._internalRoot = null;
                    var b = a.containerInfo;
                    Sk(function() {
                        gl(null, a, null, null);
                    });
                    b[uf] = null;
                }
            };
            function nl(a) {
                this._internalRoot = a;
            }
            nl.prototype.unstable_scheduleHydration = function(a) {
                if (a) {
                    var b = Hc();
                    a = {
                        blockedOn: null,
                        target: a,
                        priority: b
                    };
                    for(var c = 0; c < Qc.length && 0 !== b && b < Qc[c].priority; c++);
                    Qc.splice(c, 0, a);
                    0 === c && Vc(a);
                }
            };
            function ol(a) {
                return !(!a || 1 !== a.nodeType && 9 !== a.nodeType && 11 !== a.nodeType);
            }
            function pl(a) {
                return !(!a || 1 !== a.nodeType && 9 !== a.nodeType && 11 !== a.nodeType && (8 !== a.nodeType || " react-mount-point-unstable " !== a.nodeValue));
            }
            function ql() {}
            function rl(a, b, c, d, e) {
                if (e) {
                    if ("function" === typeof d) {
                        var f = d;
                        d = function() {
                            var a2 = hl(g);
                            f.call(a2);
                        };
                    }
                    var g = fl(b, d, a, 0, null, false, false, "", ql);
                    a._reactRootContainer = g;
                    a[uf] = g.current;
                    sf(8 === a.nodeType ? a.parentNode : a);
                    Sk();
                    return g;
                }
                for(; e = a.lastChild;)a.removeChild(e);
                if ("function" === typeof d) {
                    var h = d;
                    d = function() {
                        var a2 = hl(k);
                        h.call(a2);
                    };
                }
                var k = cl(a, 0, false, null, null, false, false, "", ql);
                a._reactRootContainer = k;
                a[uf] = k.current;
                sf(8 === a.nodeType ? a.parentNode : a);
                Sk(function() {
                    gl(b, k, c, d);
                });
                return k;
            }
            function sl(a, b, c, d, e) {
                var f = c._reactRootContainer;
                if (f) {
                    var g = f;
                    if ("function" === typeof e) {
                        var h = e;
                        e = function() {
                            var a2 = hl(g);
                            h.call(a2);
                        };
                    }
                    gl(b, g, a, e);
                } else g = rl(c, b, a, e, d);
                return hl(g);
            }
            Ec = function(a) {
                switch(a.tag){
                    case 3:
                        var b = a.stateNode;
                        if (b.current.memoizedState.isDehydrated) {
                            var c = tc(b.pendingLanes);
                            0 !== c && (Cc(b, c | 1), Ek(b, B()), 0 === (K & 6) && (Hj = B() + 500, jg()));
                        }
                        break;
                    case 13:
                        Sk(function() {
                            var b2 = Zg(a, 1);
                            if (null !== b2) {
                                var c2 = L();
                                mh(b2, a, 1, c2);
                            }
                        }), jl(a, 1);
                }
            };
            Fc = function(a) {
                if (13 === a.tag) {
                    var b = Zg(a, 134217728);
                    if (null !== b) {
                        var c = L();
                        mh(b, a, 134217728, c);
                    }
                    jl(a, 134217728);
                }
            };
            Gc = function(a) {
                if (13 === a.tag) {
                    var b = lh(a), c = Zg(a, b);
                    if (null !== c) {
                        var d = L();
                        mh(c, a, b, d);
                    }
                    jl(a, b);
                }
            };
            Hc = function() {
                return C;
            };
            Ic = function(a, b) {
                var c = C;
                try {
                    return C = a, b();
                } finally{
                    C = c;
                }
            };
            yb = function(a, b, c) {
                switch(b){
                    case "input":
                        bb(a, c);
                        b = c.name;
                        if ("radio" === c.type && null != b) {
                            for(c = a; c.parentNode;)c = c.parentNode;
                            c = c.querySelectorAll("input[name=" + JSON.stringify("" + b) + '][type="radio"]');
                            for(b = 0; b < c.length; b++){
                                var d = c[b];
                                if (d !== a && d.form === a.form) {
                                    var e = Db(d);
                                    if (!e) throw Error(p(90));
                                    Wa(d);
                                    bb(d, e);
                                }
                            }
                        }
                        break;
                    case "textarea":
                        ib(a, c);
                        break;
                    case "select":
                        b = c.value, null != b && fb(a, !!c.multiple, b, false);
                }
            };
            Gb = Rk;
            Hb = Sk;
            var tl = {
                usingClientEntryPoint: false,
                Events: [
                    Cb,
                    ue,
                    Db,
                    Eb,
                    Fb,
                    Rk
                ]
            };
            var ul = {
                findFiberByHostInstance: Wc,
                bundleType: 0,
                version: "18.2.0",
                rendererPackageName: "react-dom"
            };
            var vl = {
                bundleType: ul.bundleType,
                version: ul.version,
                rendererPackageName: ul.rendererPackageName,
                rendererConfig: ul.rendererConfig,
                overrideHookState: null,
                overrideHookStateDeletePath: null,
                overrideHookStateRenamePath: null,
                overrideProps: null,
                overridePropsDeletePath: null,
                overridePropsRenamePath: null,
                setErrorHandler: null,
                setSuspenseHandler: null,
                scheduleUpdate: null,
                currentDispatcherRef: ua.ReactCurrentDispatcher,
                findHostInstanceByFiber: function(a) {
                    a = Zb(a);
                    return null === a ? null : a.stateNode;
                },
                findFiberByHostInstance: ul.findFiberByHostInstance || kl,
                findHostInstancesForRefresh: null,
                scheduleRefresh: null,
                scheduleRoot: null,
                setRefreshHandler: null,
                getCurrentFiber: null,
                reconcilerVersion: "18.2.0-next-9e3b772b8-20220608"
            };
            if ("undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__) {
                wl = __REACT_DEVTOOLS_GLOBAL_HOOK__;
                if (!wl.isDisabled && wl.supportsFiber) try {
                    kc = wl.inject(vl), lc = wl;
                } catch (a) {}
            }
            var wl;
            exports.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = tl;
            exports.createPortal = function(a, b) {
                var c = 2 < arguments.length && void 0 !== arguments[2] ? arguments[2] : null;
                if (!ol(b)) throw Error(p(200));
                return dl(a, b, null, c);
            };
            exports.createRoot = function(a, b) {
                if (!ol(a)) throw Error(p(299));
                var c = false, d = "", e = ll;
                null !== b && void 0 !== b && (true === b.unstable_strictMode && (c = true), void 0 !== b.identifierPrefix && (d = b.identifierPrefix), void 0 !== b.onRecoverableError && (e = b.onRecoverableError));
                b = cl(a, 1, false, null, null, c, false, d, e);
                a[uf] = b.current;
                sf(8 === a.nodeType ? a.parentNode : a);
                return new ml(b);
            };
            exports.findDOMNode = function(a) {
                if (null == a) return null;
                if (1 === a.nodeType) return a;
                var b = a._reactInternals;
                if (void 0 === b) {
                    if ("function" === typeof a.render) throw Error(p(188));
                    a = Object.keys(a).join(",");
                    throw Error(p(268, a));
                }
                a = Zb(b);
                a = null === a ? null : a.stateNode;
                return a;
            };
            exports.flushSync = function(a) {
                return Sk(a);
            };
            exports.hydrate = function(a, b, c) {
                if (!pl(b)) throw Error(p(200));
                return sl(null, a, b, true, c);
            };
            exports.hydrateRoot = function(a, b, c) {
                if (!ol(a)) throw Error(p(405));
                var d = null != c && c.hydratedSources || null, e = false, f = "", g = ll;
                null !== c && void 0 !== c && (true === c.unstable_strictMode && (e = true), void 0 !== c.identifierPrefix && (f = c.identifierPrefix), void 0 !== c.onRecoverableError && (g = c.onRecoverableError));
                b = fl(b, null, a, 1, null != c ? c : null, e, false, f, g);
                a[uf] = b.current;
                sf(a);
                if (d) for(a = 0; a < d.length; a++)c = d[a], e = c._getVersion, e = e(c._source), null == b.mutableSourceEagerHydrationData ? b.mutableSourceEagerHydrationData = [
                    c,
                    e
                ] : b.mutableSourceEagerHydrationData.push(c, e);
                return new nl(b);
            };
            exports.render = function(a, b, c) {
                if (!pl(b)) throw Error(p(200));
                return sl(null, a, b, false, c);
            };
            exports.unmountComponentAtNode = function(a) {
                if (!pl(a)) throw Error(p(40));
                return a._reactRootContainer ? (Sk(function() {
                    sl(null, null, a, false, function() {
                        a._reactRootContainer = null;
                        a[uf] = null;
                    });
                }), true) : false;
            };
            exports.unstable_batchedUpdates = Rk;
            exports.unstable_renderSubtreeIntoContainer = function(a, b, c, d) {
                if (!pl(c)) throw Error(p(200));
                if (null == a || void 0 === a._reactInternals) throw Error(p(38));
                return sl(a, b, c, false, d);
            };
            exports.version = "18.2.0-next-9e3b772b8-20220608";
        }
    });
    // node_modules/react-dom/index.js
    var require_react_dom = __commonJS({
        "node_modules/react-dom/index.js" (exports, module) {
            "use strict";
            function checkDCE() {
                if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ === "undefined" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE !== "function") {
                    return;
                }
                if (false) {
                    throw new Error("^_^");
                }
                try {
                    __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(checkDCE);
                } catch (err) {
                    console.error(err);
                }
            }
            if (true) {
                checkDCE();
                module.exports = require_react_dom_production_min();
            } else {
                module.exports = null;
            }
        }
    });
    // node_modules/react-dom/client.js
    var require_client = __commonJS({
        "node_modules/react-dom/client.js" (exports) {
            "use strict";
            var m = require_react_dom();
            if (true) {
                exports.createRoot = m.createRoot;
                exports.hydrateRoot = m.hydrateRoot;
            } else {
                i = m.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
                exports.createRoot = function(c, o) {
                    i.usingClientEntryPoint = true;
                    try {
                        return m.createRoot(c, o);
                    } finally{
                        i.usingClientEntryPoint = false;
                    }
                };
                exports.hydrateRoot = function(c, h, o) {
                    i.usingClientEntryPoint = true;
                    try {
                        return m.hydrateRoot(c, h, o);
                    } finally{
                        i.usingClientEntryPoint = false;
                    }
                };
            }
            var i;
        }
    });
    // artifacts/harthmere/business-interface-live-audit-v1/entry.tsx
    var React4 = __toESM(require_react());
    var import_client = __toESM(require_client());
    // src/client/components/harthmere_business/HarthmereBusinessInterfacePanel.tsx
    var React3 = __toESM(require_react());
    // artifacts/harthmere/business-interface-live-audit-v1/PointerLockContextStub.ts
    var React1 = __toESM(require_react());
    var PointerLockManager = class {
        isLocked() {
            return false;
        }
        unlock() {}
        focusAndLock() {}
    };
    var PointerLockManagerContext = React1.createContext(new PointerLockManager());
    var usePointerLockManager = ()=>React1.useContext(PointerLockManagerContext);
    // src/client/components/biomes_ui/theme/biomesUITheme.ts
    var BIOMES_UI_THEME_CSS = `
:root {
  --biomes-bg-deep: rgba(7, 12, 26, 0.92);
  --biomes-bg-glass: rgba(13, 22, 44, 0.78);
  --biomes-bg-glass-strong: rgba(8, 14, 32, 0.92);
  --biomes-edge-cyan: rgba(74, 222, 255, 0.85);
  --biomes-edge-cyan-soft: rgba(74, 222, 255, 0.35);
  --biomes-edge-magenta: rgba(255, 84, 196, 0.8);
  --biomes-edge-magenta-soft: rgba(255, 84, 196, 0.32);
  --biomes-warn-amber: rgba(255, 184, 68, 0.95);
  --biomes-fg: #e8f4ff;
  --biomes-fg-muted: rgba(232, 244, 255, 0.65);
  --biomes-fg-dim: rgba(232, 244, 255, 0.4);
  --biomes-radius: 6px;
  --biomes-clip: polygon(
    12px 0,
    100% 0,
    100% calc(100% - 12px),
    calc(100% - 12px) 100%,
    0 100%,
    0 12px
  );
}

.biomes-ui-panel {
  background: var(--biomes-bg-glass);
  color: var(--biomes-fg);
  border: 1px solid var(--biomes-edge-cyan-soft);
  box-shadow:
    inset 0 0 24px rgba(74, 222, 255, 0.06),
    0 0 22px rgba(0, 0, 0, 0.55);
  clip-path: var(--biomes-clip);
  backdrop-filter: blur(10px) saturate(115%);
  -webkit-backdrop-filter: blur(10px) saturate(115%);
  position: relative;
}
.biomes-ui-panel::before {
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, var(--biomes-edge-cyan) 50%, transparent 100%);
  opacity: 0.7;
}

.biomes-ui-slot {
  width: 56px;
  height: 56px;
  background: linear-gradient(180deg, rgba(13, 22, 44, 0.78) 0%, rgba(7, 12, 26, 0.92) 100%);
  border: 1px solid var(--biomes-edge-cyan-soft);
  clip-path: polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  color: var(--biomes-fg);
  cursor: pointer;
  transition: transform 80ms ease, border-color 120ms ease, box-shadow 120ms ease;
  outline: none;
}
.biomes-ui-slot:focus-visible,
.biomes-ui-slot[data-focused="true"] {
  border-color: var(--biomes-edge-cyan);
  box-shadow: 0 0 14px rgba(74, 222, 255, 0.45);
}
.biomes-ui-slot[data-selected="true"] {
  border-color: var(--biomes-edge-magenta);
  box-shadow:
    0 0 14px rgba(255, 84, 196, 0.55),
    inset 0 0 18px rgba(255, 84, 196, 0.15);
}
.biomes-ui-slot:hover {
  transform: translateY(-2px);
}

.biomes-ui-slot-key {
  position: absolute;
  bottom: 2px;
  right: 4px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--biomes-fg-muted);
  text-shadow: 0 0 4px rgba(0, 0, 0, 0.65);
  pointer-events: none;
}

.biomes-ui-tab {
  position: relative;
  padding: 8px 14px;
  color: var(--biomes-fg-muted);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  background: transparent;
  border: 0;
  cursor: pointer;
  outline: none;
}
.biomes-ui-tab:hover,
.biomes-ui-tab:focus-visible,
.biomes-ui-tab[data-focused="true"] { color: var(--biomes-fg); }
.biomes-ui-tab[aria-selected="true"] { color: #fff; }
.biomes-ui-tab[aria-selected="true"]::after {
  content: "";
  position: absolute;
  left: 12px; right: 12px; bottom: 2px;
  height: 2px;
  background: linear-gradient(90deg, var(--biomes-edge-cyan) 0%, var(--biomes-edge-magenta) 100%);
  box-shadow: 0 0 10px rgba(74, 222, 255, 0.5);
}

.mini-phone.shop-container,
.mini-phone.item-buyer {
  background: rgba(5, 10, 22, 0.62);
  border: 1px solid rgba(74, 222, 255, 0.22);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.58);
}

.mini-phone.shop-container .mini-phone-screen-wrap,
.mini-phone.item-buyer .mini-phone-screen-wrap {
  min-height: 0;
}

.biomes-ui-shop-screen {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  box-sizing: border-box;
  overflow: hidden;
}

.biomes-ui-shop-screen__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex: 0 0 auto;
  min-width: 0;
}

.biomes-ui-shop-screen__identity {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.biomes-ui-shop-screen__eyebrow {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--biomes-edge-cyan);
}

.biomes-ui-shop-screen h2 {
  margin: 0;
  font-size: 18px;
  line-height: 1.05;
  color: var(--biomes-fg);
  overflow-wrap: anywhere;
}

.biomes-ui-shop-screen__subtitle {
  margin: 0;
  max-width: 58ch;
  font-size: 12px;
  line-height: 1.35;
  color: var(--biomes-fg-muted);
}

.biomes-ui-shop-screen__actions {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 6px;
}

.biomes-ui-shop-screen__close,
.biomes-ui-action-button {
  border: 1px solid var(--biomes-edge-cyan-soft);
  border-radius: 5px;
  background: rgba(7, 12, 26, 0.78);
  color: var(--biomes-fg);
  cursor: pointer;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 7px 10px;
  outline: none;
}

.biomes-ui-shop-screen__close {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.biomes-ui-shop-screen__close span {
  display: inline-grid;
  place-items: center;
  min-width: 26px;
  padding: 2px 5px;
  border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.2);
  color: var(--biomes-fg-muted);
  background: rgba(255,255,255,0.08);
}

.biomes-ui-shop-screen__close:hover,
.biomes-ui-shop-screen__close:focus-visible,
.biomes-ui-action-button:hover,
.biomes-ui-action-button:focus-visible {
  border-color: var(--biomes-edge-cyan);
  box-shadow: 0 0 14px rgba(74, 222, 255, 0.26);
}

.biomes-ui-action-button:disabled,
.biomes-ui-shop-stepper button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  box-shadow: none;
}

.biomes-ui-shop-screen__body {
  min-height: 0;
  flex: 1 1 auto;
  display: grid;
  grid-template-columns: minmax(230px, 0.86fr) minmax(350px, 1.24fr);
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 10px;
}

.biomes-ui-shop-section {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 10px;
  border: 1px solid rgba(74, 222, 255, 0.24);
  background:
    radial-gradient(circle at 12% 0%, rgba(74, 222, 255, 0.12), transparent 35%),
    linear-gradient(180deg, rgba(13, 22, 44, 0.68), rgba(7, 12, 26, 0.84));
  clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
}

.biomes-ui-shop-section__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.biomes-ui-shop-section__header h3 {
  margin: 0;
  color: var(--biomes-fg-muted);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.biomes-ui-shop-section__header span {
  min-width: 0;
  color: var(--biomes-fg-dim);
  font-size: 11px;
  text-align: right;
  overflow-wrap: anywhere;
}

.biomes-ui-shop-section--inventory {
  grid-row: span 2;
  overflow: hidden;
}

.biomes-ui-shop-section--summary {
  grid-column: 1 / -1;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
}

.biomes-ui-shop-merchant {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.biomes-ui-shop-merchant .avatar,
.biomes-ui-shop-merchant img {
  width: 44px;
  height: 44px;
  border-radius: 999px;
  border: 1px solid var(--biomes-edge-cyan-soft);
  object-fit: cover;
}

.biomes-ui-shop-merchant .avatar {
  flex: 0 0 auto;
  background:
    radial-gradient(circle at 50% 35%, rgba(232, 244, 255, 0.22), transparent 30%),
    linear-gradient(180deg, rgba(74, 222, 255, 0.2), rgba(7, 12, 26, 0.86));
}

.biomes-ui-shop-merchant__copy {
  min-width: 0;
}

.biomes-ui-shop-merchant__copy strong {
  display: block;
  font-size: 13px;
  color: var(--biomes-fg);
  overflow-wrap: anywhere;
}

.biomes-ui-shop-merchant__copy span,
.biomes-ui-shop-muted {
  color: var(--biomes-fg-muted);
  font-size: 12px;
  line-height: 1.35;
}

.biomes-ui-shop-grid {
  display: grid;
  gap: 6px;
  align-content: start;
  overflow: auto;
  padding: 1px;
}

.biomes-ui-shop-grid [role="row"] {
  gap: 6px !important;
  flex-wrap: nowrap;
}

.biomes-ui-shop-slot-button {
  width: 72px;
  min-height: 92px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--biomes-fg);
  outline: none;
  cursor: pointer;
}

.biomes-ui-shop-slot-button .cell {
  width: 52px;
  height: 52px;
  flex: 0 0 auto;
}

.biomes-ui-shop-slot-button:focus-visible,
.biomes-ui-shop-slot-button[data-focused="true"] {
  border-color: var(--biomes-edge-cyan);
  background: rgba(74, 222, 255, 0.08);
  box-shadow: 0 0 12px rgba(74, 222, 255, 0.24);
}

.biomes-ui-shop-slot-button[data-selected="true"] {
  border-color: var(--biomes-edge-magenta);
  background: rgba(255, 84, 196, 0.1);
  box-shadow: inset 0 0 16px rgba(255, 84, 196, 0.12);
}

.biomes-ui-shop-slot-button__label {
  width: 100%;
  min-height: 28px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: center;
  font-size: 10px;
  line-height: 1.15;
  color: var(--biomes-fg-muted);
  overflow-wrap: anywhere;
}

.biomes-ui-shop-slot-button__label strong {
  color: var(--biomes-fg);
  font-size: 11px;
}

.biomes-ui-shop-stepper {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
  outline: none;
}

.biomes-ui-shop-stepper:focus-visible {
  box-shadow: 0 0 0 2px var(--biomes-edge-cyan-soft);
}

.biomes-ui-shop-stepper__label {
  color: var(--biomes-fg-muted);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.biomes-ui-shop-stepper button,
.biomes-ui-shop-stepper output {
  min-width: 34px;
  min-height: 28px;
  display: inline-grid;
  place-items: center;
  border-radius: 5px;
  border: 1px solid var(--biomes-edge-cyan-soft);
  background: rgba(7, 12, 26, 0.72);
  color: var(--biomes-fg);
  font-size: 11px;
  font-weight: 800;
}

.biomes-ui-shop-stepper button {
  cursor: pointer;
}

.biomes-ui-shop-stepper output {
  min-width: 48px;
  border-color: rgba(255, 184, 68, 0.3);
  color: rgba(255, 231, 170, 0.96);
}

.biomes-ui-shop-total {
  color: var(--biomes-fg);
  font-size: 13px;
  font-weight: 800;
}

.biomes-ui-shop-total span {
  color: rgba(255, 231, 170, 0.96);
}

.biomes-ui-shop-inventory-pane {
  --inventory-cell-gap: 3px;
  --inventory-divider-size: 8px;
  --cell-width: clamp(34px, 4.8vmin, 42px);
  --cell-height: var(--cell-width);
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  width: 100%;
  overflow: auto;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 2px 0 4px;
}

.biomes-ui-shop-inventory-pane .inventory-cells.normal {
  width: calc((var(--cell-width) * 9) + (var(--inventory-cell-gap) * 8));
  min-width: calc((var(--cell-width) * 9) + (var(--inventory-cell-gap) * 8));
  justify-content: flex-start;
  align-content: flex-start;
  margin: 0 auto;
}

.biomes-ui-shop-inventory-pane .inventory-cells.normal .break-medium {
  height: var(--inventory-divider-size);
}

.biomes-ui-shop-inventory-pane .cell {
  flex: 0 0 auto;
}

.biomes-ui-shop-inventory-pane .cell.cash {
  padding: 0 8px;
}

.biomes-ui-shop-inventory-pane .cell.cash span {
  font-size: 12px;
}

.biomes-ui-shop-inventory-pane .cell.cash img {
  left: 5px;
}

@keyframes biomes-ui-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(74, 222, 255, 0.0), inset 0 0 0 0 rgba(74, 222, 255, 0.0); }
  50%      { box-shadow: 0 0 18px 4px rgba(74, 222, 255, 0.75), inset 0 0 12px 0 rgba(74, 222, 255, 0.45); }
}
.biomes-ui-blink-pulse { animation: biomes-ui-pulse 1.2s ease-in-out infinite; }

@keyframes biomes-ui-ring {
  0%, 100% { outline-color: rgba(255, 184, 68, 0.0); }
  50%      { outline-color: rgba(255, 184, 68, 0.95); }
}
.biomes-ui-blink-ring {
  outline: 2px solid transparent;
  outline-offset: 3px;
  animation: biomes-ui-ring 1s ease-in-out infinite;
}

@keyframes biomes-ui-shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.biomes-ui-blink-shimmer { position: relative; overflow: hidden; }
.biomes-ui-blink-shimmer::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(100deg, transparent 30%, rgba(74, 222, 255, 0.4) 50%, transparent 70%);
  background-size: 200% 100%;
  animation: biomes-ui-shimmer 1.6s linear infinite;
  pointer-events: none;
}

@keyframes biomes-ui-arrow-bob {
  0%, 100% { transform: translate(-50%, 0); }
  50%      { transform: translate(-50%, -6px); }
}
.biomes-ui-blink-arrow { position: relative; }
.biomes-ui-blink-arrow::before {
  content: "\\25BC";
  position: absolute;
  left: 50%;
  bottom: 100%;
  color: var(--biomes-warn-amber);
  font-size: 18px;
  text-shadow: 0 0 8px rgba(255, 184, 68, 0.85);
  animation: biomes-ui-arrow-bob 0.8s ease-in-out infinite;
  pointer-events: none;
}

@media (max-width: 768px) {
  .biomes-ui-slot { width: 44px; height: 44px; }
  .biomes-ui-tab { font-size: 10px; padding: 6px 8px; letter-spacing: 0.08em; }
  .biomes-ui-shop-screen { padding: 10px; overflow: auto; }
  .biomes-ui-shop-screen__header { flex-direction: column; }
  .biomes-ui-shop-screen__actions { justify-content: flex-start; }
  .biomes-ui-shop-screen__body {
    display: flex;
    flex-direction: column;
    overflow: visible;
  }
  .biomes-ui-shop-section--inventory { min-height: 360px; }
  .biomes-ui-shop-inventory-pane {
    --cell-width: clamp(32px, 10vw, 40px);
    justify-content: flex-start;
  }
  .biomes-ui-shop-section--summary { flex-direction: column; align-items: stretch; }
  .biomes-ui-shop-slot-button { width: 64px; min-height: 86px; }
}
@media (max-width: 480px) {
  .biomes-ui-slot { width: 38px; height: 38px; }
  .biomes-ui-shop-screen h2 { font-size: 16px; }
  .biomes-ui-shop-section { padding: 9px; }
  .biomes-ui-shop-stepper { align-items: stretch; }
  .biomes-ui-shop-stepper button,
  .biomes-ui-shop-stepper output { flex: 1 1 36px; }
  .biomes-ui-shop-inventory-pane { --cell-width: 32px; }
}

.biomes-ui-open-prompt {
  position: fixed;
  left: 18px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10020;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 13px;
  border: 1px solid rgba(105, 231, 255, 0.35);
  border-radius: 16px;
  background:
    radial-gradient(circle at 20% 20%, rgba(105, 231, 255, 0.22), transparent 38%),
    linear-gradient(135deg, rgba(6, 12, 28, 0.88), rgba(18, 23, 45, 0.76));
  box-shadow:
    0 0 22px rgba(105, 231, 255, 0.18),
    inset 0 0 18px rgba(105, 231, 255, 0.08);
  color: rgba(238, 250, 255, 0.96);
  pointer-events: none;
  backdrop-filter: blur(12px);
  animation: biomes-ui-open-prompt-breathe 1.8s ease-in-out infinite;
}

.biomes-ui-open-prompt__key {
  min-width: 34px;
  min-height: 34px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  border: 1px solid rgba(255, 221, 130, 0.55);
  background: rgba(255, 221, 130, 0.13);
  color: #ffe28a;
  font-weight: 800;
  font-size: 18px;
  box-shadow: 0 0 14px rgba(255, 221, 130, 0.25);
}

.biomes-ui-open-prompt__text {
  display: flex;
  flex-direction: column;
  line-height: 1.05;
}

.biomes-ui-open-prompt__label {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.biomes-ui-open-prompt__hint {
  margin-top: 3px;
  font-size: 11px;
  color: rgba(180, 225, 255, 0.8);
}

@keyframes biomes-ui-open-prompt-breathe {
  0%, 100% {
    opacity: 0.86;
    transform: translateY(-50%) scale(1);
  }
  50% {
    opacity: 1;
    transform: translateY(-50%) scale(1.035);
  }
}

@media (max-width: 768px) {
  .biomes-ui-open-prompt {
    left: 10px;
    top: auto;
    bottom: 98px;
    transform: none;
  }

  @keyframes biomes-ui-open-prompt-breathe {
    0%, 100% {
      opacity: 0.86;
      transform: scale(1);
    }
    50% {
      opacity: 1;
      transform: scale(1.035);
    }
  }
}


.biomes-ui-vitals-panel {
  position: fixed;
  left: 12px;
  top: 12px;
  z-index: 1088;
  width: min(18rem, calc(100vw - 1rem));
  pointer-events: none;
  user-select: none;
  color: var(--biomes-fg);
  border: 1px solid rgba(74, 222, 255, 0.28);
  background:
    radial-gradient(circle at 14% 0%, rgba(74, 222, 255, 0.16), transparent 32%),
    radial-gradient(circle at 88% 12%, rgba(255, 84, 196, 0.11), transparent 34%),
    linear-gradient(180deg, rgba(13, 22, 44, 0.84), rgba(7, 12, 26, 0.92));
  box-shadow:
    0 10px 28px rgba(0, 0, 0, 0.5),
    inset 0 0 22px rgba(74, 222, 255, 0.06);
  clip-path: var(--biomes-clip);
  backdrop-filter: blur(12px) saturate(118%);
  -webkit-backdrop-filter: blur(12px) saturate(118%);
  padding: 10px 11px 11px;
}

.biomes-ui-vitals-panel::before {
  content: "";
  position: absolute;
  left: 10px;
  right: 10px;
  top: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--biomes-edge-cyan), var(--biomes-edge-magenta), transparent);
  opacity: 0.78;
}

.biomes-ui-vitals-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.biomes-ui-vitals-panel__identity {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.biomes-ui-vitals-panel__game {
  max-width: 11.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(232, 244, 255, 0.96);
  text-shadow: 0 0 10px rgba(74, 222, 255, 0.3);
}

.biomes-ui-vitals-panel__title {
  max-width: 12.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 10px;
  font-style: italic;
  color: rgba(232, 244, 255, 0.62);
}

.biomes-ui-vitals-panel__state {
  flex: 0 0 auto;
  max-width: 5.75rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border: 1px solid rgba(255, 184, 68, 0.26);
  background: rgba(255, 184, 68, 0.08);
  color: rgba(255, 231, 170, 0.9);
  border-radius: 7px;
  padding: 3px 6px;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.biomes-ui-vitals-panel__bars {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.biomes-ui-vitals-bar__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 3px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(232, 244, 255, 0.7);
}

.biomes-ui-vitals-bar__value {
  font-variant-numeric: tabular-nums;
  color: rgba(232, 244, 255, 0.92);
}

.biomes-ui-vitals-bar__track {
  position: relative;
  height: 10px;
  overflow: hidden;
  border-radius: 999px;
  border: 1px solid rgba(232, 244, 255, 0.12);
  background: rgba(0, 0, 0, 0.42);
  box-shadow: inset 0 0 8px rgba(0, 0, 0, 0.65);
}

.biomes-ui-vitals-bar__track::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(255,255,255,0.08) 0 1px, transparent 1px 12px);
  opacity: 0.55;
  pointer-events: none;
}

.biomes-ui-vitals-bar__fill {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 999px;
  transition: width 180ms ease;
}

.biomes-ui-vitals-bar__fill--health {
  background: linear-gradient(90deg, #ff426d, #ff876d, #ffd0a0);
  box-shadow: 0 0 14px rgba(255, 66, 109, 0.42);
}

.biomes-ui-vitals-bar__fill--mana {
  background: linear-gradient(90deg, #3edbff, #7c8dff, #c276ff);
  box-shadow: 0 0 14px rgba(74, 222, 255, 0.44);
}

.biomes-ui-vitals-bar__fill--stamina {
  background: linear-gradient(90deg, #35e68a, #b7ef5f, #ffd56b);
  box-shadow: 0 0 14px rgba(92, 240, 139, 0.42);
}

.biomes-ui-vitals-panel__standing {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  margin-top: 9px;
}

.biomes-ui-vitals-chip {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border: 1px solid rgba(232, 244, 255, 0.12);
  background: rgba(8, 14, 32, 0.72);
  border-radius: 8px;
  padding: 5px 4px;
}

.biomes-ui-vitals-chip__label {
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(232, 244, 255, 0.52);
}

.biomes-ui-vitals-chip__value {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  color: rgba(232, 244, 255, 0.94);
}

.biomes-ui-vitals-chip__track {
  width: 100%;
  height: 3px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.48);
}

.biomes-ui-vitals-chip__fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  transition: width 180ms ease;
}

.biomes-ui-vitals-chip[data-tone="like"] .biomes-ui-vitals-chip__fill {
  background: linear-gradient(90deg, #5dffad, #baff7f);
  box-shadow: 0 0 8px rgba(93, 255, 173, 0.35);
}

.biomes-ui-vitals-chip[data-tone="law"] .biomes-ui-vitals-chip__fill {
  background: linear-gradient(90deg, #70b7ff, #b4d6ff);
  box-shadow: 0 0 8px rgba(112, 183, 255, 0.35);
}

.biomes-ui-vitals-chip[data-tone="notoriety"] .biomes-ui-vitals-chip__fill {
  background: linear-gradient(90deg, #ffb86b, #ff5fc8);
  box-shadow: 0 0 8px rgba(255, 184, 107, 0.35);
}


.biomes-building-system {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.biomes-building-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(220px, 320px);
  gap: 14px;
  align-items: stretch;
  padding: 12px;
  border: 1px solid var(--biomes-edge-cyan-soft);
  background:
    radial-gradient(circle at 18% 0%, rgba(74, 222, 255, 0.14), transparent 34%),
    radial-gradient(circle at 88% 14%, rgba(255, 84, 196, 0.1), transparent 32%),
    var(--biomes-bg-glass);
  clip-path: var(--biomes-clip);
}

.biomes-building-eyebrow {
  margin-bottom: 4px;
  color: var(--biomes-edge-cyan);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.biomes-building-title {
  margin: 0;
  color: var(--biomes-fg);
  font-size: 18px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.biomes-building-copy,
.biomes-building-panel-header p,
.biomes-building-card p {
  margin: 6px 0 0;
  color: var(--biomes-fg-muted);
  font-size: 12px;
  line-height: 1.5;
}

.biomes-building-status {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid rgba(255, 184, 68, 0.26);
  background: rgba(255, 184, 68, 0.08);
  color: var(--biomes-fg-muted);
  font-size: 11px;
  min-width: 0;
}

.biomes-building-status strong {
  color: var(--biomes-fg);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.biomes-building-status span:last-child {
  overflow-wrap: anywhere;
}

.biomes-building-status__label {
  color: var(--biomes-warn-amber);
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.biomes-building-step-rail {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 7px 10px;
}

.biomes-building-step {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.biomes-building-step span {
  display: inline-flex;
  min-width: 30px;
  justify-content: center;
  border: 1px solid rgba(232, 244, 255, 0.16);
  border-radius: 3px;
  padding: 1px 4px;
  font-size: 9px;
  opacity: 0.68;
}

.biomes-building-layout {
  display: grid;
  grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}

.biomes-building-sidebar,
.biomes-building-main {
  min-width: 0;
}

.biomes-building-card {
  width: 100%;
  box-sizing: border-box;
  padding: 11px 12px;
  border: 1px solid var(--biomes-edge-cyan-soft);
  background: var(--biomes-bg-glass);
  color: var(--biomes-fg);
  clip-path: var(--biomes-clip);
}

.biomes-building-select-card {
  display: block;
  min-height: 138px;
  text-align: left;
  cursor: pointer;
  outline: none;
}

.biomes-building-select-card:hover,
.biomes-building-select-card:focus-visible,
.biomes-building-select-card[data-focused="true"] {
  border-color: var(--biomes-edge-cyan);
  box-shadow: 0 0 16px rgba(74, 222, 255, 0.32);
}

.biomes-building-select-card[data-selected="true"] {
  border-color: var(--biomes-edge-magenta);
  box-shadow:
    0 0 14px rgba(255, 84, 196, 0.44),
    inset 0 0 18px rgba(255, 84, 196, 0.1);
}

.biomes-building-card-title,
.biomes-building-panel-header .biomes-building-card-title {
  margin: 0;
  color: var(--biomes-fg);
  font-size: 15px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.biomes-building-card-title-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: flex-start;
  margin-bottom: 4px;
}

.biomes-building-card-title-row strong {
  font-size: 13px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.biomes-building-card-title-row span {
  flex: 0 0 auto;
  color: var(--biomes-warn-amber);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.biomes-building-muted {
  color: var(--biomes-fg-muted);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.biomes-building-quote {
  margin: 8px 0 0;
  color: var(--biomes-fg-muted);
  font-size: 13px;
  line-height: 1.55;
  font-style: italic;
}

.biomes-building-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.biomes-building-actions .biomes-ui-tab {
  border: 1px solid var(--biomes-edge-cyan-soft);
  background: rgba(74, 222, 255, 0.06);
}

.biomes-building-actions .biomes-ui-tab:disabled,
.biomes-building-actions .biomes-ui-tab[aria-disabled="true"] {
  cursor: not-allowed;
  opacity: 0.45;
}

.biomes-building-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.biomes-building-grid [role="row"] {
  gap: 8px !important;
}

.biomes-building-grid [role="row"] > * {
  flex: 1 1 0;
  min-width: 0;
}

.biomes-building-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 10px;
}

.biomes-building-chip {
  border: 1px solid rgba(232, 244, 255, 0.14);
  background: rgba(8, 14, 32, 0.72);
  border-radius: 999px;
  padding: 3px 7px;
  color: var(--biomes-fg-muted);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.biomes-building-panel-header {
  margin-bottom: 10px;
}

.biomes-building-stage-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.biomes-building-stage {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 9px;
  align-items: center;
  padding: 9px;
  border: 1px solid var(--biomes-edge-cyan-soft);
  background: var(--biomes-bg-glass);
  clip-path: var(--biomes-clip);
}

.biomes-building-stage[data-active="true"] {
  border-color: var(--biomes-warn-amber);
  box-shadow: 0 0 12px rgba(255, 184, 68, 0.18);
}

.biomes-building-stage[data-complete="true"] {
  border-color: rgba(93, 255, 173, 0.45);
}

.biomes-building-stage__marker {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--biomes-edge-cyan-soft);
  border-radius: 50%;
  color: var(--biomes-fg);
  font-weight: 900;
}

.biomes-building-stage strong {
  display: block;
  color: var(--biomes-fg);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.biomes-building-stage span {
  display: block;
  margin-top: 2px;
  color: var(--biomes-fg-muted);
  font-size: 10px;
  line-height: 1.35;
}

.biomes-building-property-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 10px;
}

.biomes-building-metric {
  padding: 8px;
  border: 1px solid var(--biomes-edge-cyan-soft);
  background: rgba(8, 14, 32, 0.72);
}

.biomes-building-metric span {
  display: block;
  color: var(--biomes-fg-dim);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.biomes-building-metric strong {
  display: block;
  margin-top: 4px;
  color: var(--biomes-fg);
  font-size: 12px;
  overflow-wrap: anywhere;
}

.biomes-building-summary dl {
  display: grid;
  gap: 6px;
  margin: 10px 0 0;
}

.biomes-building-summary-row {
  display: grid;
  grid-template-columns: 78px minmax(0, 1fr);
  gap: 8px;
  align-items: baseline;
  border-bottom: 1px solid rgba(232, 244, 255, 0.08);
  padding-bottom: 5px;
}

.biomes-building-summary-row dt {
  color: var(--biomes-fg-dim);
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.biomes-building-summary-row dd {
  margin: 0;
  color: var(--biomes-fg);
  font-size: 11px;
  overflow-wrap: anywhere;
}

@media (max-width: 860px) {
  .biomes-building-hero,
  .biomes-building-layout {
    grid-template-columns: 1fr;
  }

  .biomes-building-sidebar {
    order: 2;
  }

  .biomes-building-main {
    order: 1;
  }

  .biomes-building-property-grid,
  .biomes-building-stage-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 520px) {
  .biomes-building-title {
    font-size: 15px;
  }

  .biomes-building-step-rail {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .biomes-building-step {
    justify-content: center;
    width: 100%;
  }

  .biomes-building-grid [role="row"] {
    flex-direction: column;
  }

  .biomes-building-property-grid,
  .biomes-building-stage-list {
    grid-template-columns: 1fr;
  }

  .biomes-building-actions .biomes-ui-tab {
    width: 100%;
  }
}

@media (max-width: 768px) {
  .biomes-ui-vitals-panel {
    left: 8px;
    top: 8px;
    width: min(16.25rem, calc(100vw - 1rem));
    padding: 8px 9px 9px;
  }
  .biomes-ui-vitals-panel__game { font-size: 11px; }
  .biomes-ui-vitals-panel__title { font-size: 9px; }
  .biomes-ui-vitals-panel__state { font-size: 8px; max-width: 4.75rem; }
  .biomes-ui-vitals-bar__track { height: 8px; }
  .biomes-ui-vitals-panel__standing { gap: 4px; }
}
/* Production inventory layout */
.biomes-ui-inventory {
  display: grid;
  grid-template-columns: 240px minmax(360px, 1fr) 280px;
  gap: 16px;
  min-height: 420px;
}
.biomes-ui-inventory__sidebar,
.biomes-ui-inventory__main,
.biomes-ui-inventory__details {
  min-width: 0;
}
.biomes-ui-inventory__toolbar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}
.biomes-ui-inventory__search {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 220px;
  color: var(--biomes-fg-muted);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.biomes-ui-inventory__search input {
  min-height: 34px;
  padding: 6px 10px;
  color: var(--biomes-fg);
  background: var(--biomes-bg-glass-strong);
  border: 1px solid var(--biomes-edge-cyan-soft);
  border-radius: 4px;
  outline: none;
}
.biomes-ui-inventory__search input:focus-visible {
  border-color: var(--biomes-edge-cyan);
  box-shadow: 0 0 12px rgba(74, 222, 255, 0.32);
}
.biomes-ui-inventory__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  justify-content: flex-end;
}
.biomes-ui-inventory__slot {
  position: relative;
}
.biomes-ui-inventory__count {
  position: absolute;
  right: 4px;
  top: 2px;
  font-size: 10px;
  font-weight: 800;
  color: #fff;
  text-shadow: 0 0 4px rgba(0,0,0,0.8);
}
.biomes-ui-inventory__durability {
  position: absolute;
  left: 4px;
  right: auto;
  bottom: 3px;
  height: 3px;
  background: linear-gradient(90deg, var(--biomes-edge-cyan), var(--biomes-edge-magenta));
  border-radius: 3px;
}
.biomes-ui-inventory__currency-list,
.biomes-ui-inventory__details-card,
.biomes-ui-inventory__contract-note {
  padding: 10px;
  background: var(--biomes-bg-glass);
  border: 1px solid var(--biomes-edge-cyan-soft);
  border-radius: 6px;
}
.biomes-ui-inventory__currency-row {
  display: grid;
  grid-template-columns: 24px 1fr auto;
  gap: 8px;
  align-items: center;
  padding: 4px 0;
  font-size: 12px;
}
.biomes-ui-inventory__details-heading {
  display: grid;
  grid-template-columns: 42px 1fr;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}
.biomes-ui-inventory__details-heading p {
  margin: 2px 0 0;
  color: var(--biomes-fg-muted);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.biomes-ui-inventory__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-top: 10px;
}
.biomes-ui-action-button,
.biomes-ui-inventory__actions button {
  padding: 7px 8px;
  color: var(--biomes-fg);
  background: rgba(74, 222, 255, 0.08);
  border: 1px solid var(--biomes-edge-cyan-soft);
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
}
.biomes-ui-action-button:hover,
.biomes-ui-action-button:focus-visible,
.biomes-ui-inventory__actions button:hover,
.biomes-ui-inventory__actions button:focus-visible {
  border-color: var(--biomes-edge-cyan);
  box-shadow: 0 0 12px rgba(74, 222, 255, 0.22);
}
.biomes-ui-inventory__actions button:disabled {
  opacity: 0.42;
  cursor: not-allowed;
}
.biomes-ui-inventory__contract-note {
  margin-top: 10px;
  color: var(--biomes-fg-muted);
  font-size: 11px;
  line-height: 1.4;
}
.biomes-ui-guild-building-guide {
  margin-top: 14px;
  padding: 10px;
  border: 1px solid var(--biomes-edge-magenta-soft);
  background: rgba(255, 84, 196, 0.08);
  border-radius: 6px;
  font-size: 12px;
}
.biomes-ui-guild-building-guide ol {
  margin: 8px 0 0 18px;
  padding: 0;
  color: var(--biomes-fg-muted);
}
@media (max-width: 980px) {
  .biomes-ui-inventory {
    grid-template-columns: 1fr;
  }
  .biomes-ui-inventory__toolbar {
    align-items: stretch;
    flex-direction: column;
  }
  .biomes-ui-inventory__filters {
    justify-content: flex-start;
  }
}
@media (max-width: 560px) {
  .biomes-ui-inventory {
    gap: 12px;
    min-height: auto;
  }
  .biomes-ui-inventory__actions {
    grid-template-columns: 1fr;
  }
}
`;
    var BIOMES_UI_THEME_ID = "biomes-ui-theme";
    function installBiomesUITheme() {
        if (typeof document === "undefined") return;
        if (document.getElementById(BIOMES_UI_THEME_ID)) return;
        const style = document.createElement("style");
        style.id = BIOMES_UI_THEME_ID;
        style.setAttribute("data-source", "biomes_ui");
        style.appendChild(document.createTextNode(BIOMES_UI_THEME_CSS));
        document.head.appendChild(style);
    }
    // src/client/components/biomes_ui/nav/RovingGrid.tsx
    var React2 = __toESM(require_react());
    var import_react = __toESM(require_react());
    function RovingGrid({ items , renderCell , onActivate , initialRow =0 , initialCol =0 , ariaLabel , className , style  }) {
        const [pos, setPos] = (0, import_react.useState)({
            row: initialRow,
            col: initialCol
        });
        const cellRefs = (0, import_react.useRef)(/* @__PURE__ */ new Map());
        const moveTo = (0, import_react.useCallback)((row, col)=>{
            var _items_clampedRow, _cellRefs_current_get;
            if (items.length === 0) return;
            const clampedRow = (row % items.length + items.length) % items.length;
            var _items_clampedRow_length;
            const rowLen = (_items_clampedRow_length = (_items_clampedRow = items[clampedRow]) === null || _items_clampedRow === void 0 ? void 0 : _items_clampedRow.length) !== null && _items_clampedRow_length !== void 0 ? _items_clampedRow_length : 0;
            if (rowLen === 0) return;
            const clampedCol = (col % rowLen + rowLen) % rowLen;
            setPos({
                row: clampedRow,
                col: clampedCol
            });
            (_cellRefs_current_get = cellRefs.current.get(`${clampedRow}:${clampedCol}`)) === null || _cellRefs_current_get === void 0 ? void 0 : _cellRefs_current_get.focus();
        }, [
            items
        ]);
        (0, import_react.useEffect)(()=>{}, []);
        const handleKey = (0, import_react.useCallback)((e, row, col)=>{
            var _items_row;
            var _items_row_length;
            const rowLen = (_items_row_length = (_items_row = items[row]) === null || _items_row === void 0 ? void 0 : _items_row.length) !== null && _items_row_length !== void 0 ? _items_row_length : 0;
            const last = items.length - 1;
            switch(e.key){
                case "ArrowRight":
                    e.preventDefault();
                    moveTo(row, col + 1);
                    break;
                case "ArrowLeft":
                    e.preventDefault();
                    moveTo(row, col - 1);
                    break;
                case "ArrowDown":
                    e.preventDefault();
                    moveTo(row + 1, col);
                    break;
                case "ArrowUp":
                    e.preventDefault();
                    moveTo(row - 1, col);
                    break;
                case "Home":
                    e.preventDefault();
                    if (e.ctrlKey) moveTo(0, 0);
                    else moveTo(row, 0);
                    break;
                case "End":
                    var _items_last;
                    e.preventDefault();
                    var _items_last_length;
                    if (e.ctrlKey) moveTo(last, ((_items_last_length = (_items_last = items[last]) === null || _items_last === void 0 ? void 0 : _items_last.length) !== null && _items_last_length !== void 0 ? _items_last_length : 1) - 1);
                    else moveTo(row, rowLen - 1);
                    break;
                case "PageDown":
                    e.preventDefault();
                    moveTo(Math.min(last, row + 3), col);
                    break;
                case "PageUp":
                    e.preventDefault();
                    moveTo(Math.max(0, row - 3), col);
                    break;
                case "Enter":
                case " ":
                    e.preventDefault();
                    onActivate === null || onActivate === void 0 ? void 0 : onActivate(row, col, items[row][col]);
                    break;
            }
        }, [
            items,
            moveTo,
            onActivate
        ]);
        return /*#__PURE__*/ React4.createElement("div", {
            role: "grid",
            "aria-label": ariaLabel,
            className: className,
            style: style
        }, items.map((row, r)=>{
            /*#__PURE__*/ return React4.createElement("div", {
                role: "row",
                key: r,
                style: {
                    display: "flex",
                    gap: 4
                }
            }, row.map((item, c)=>{
                const focused = r === pos.row && c === pos.col;
                return /*#__PURE__*/ React4.createElement(React2.Fragment, {
                    key: c
                }, renderCell(item, {
                    row: r,
                    col: c,
                    focused
                }, {
                    ref: (el)=>{
                        cellRefs.current.set(`${r}:${c}`, el);
                    },
                    tabIndex: focused ? 0 : -1,
                    onFocus: ()=>setPos({
                            row: r,
                            col: c
                        }),
                    onClick: ()=>{
                        setPos({
                            row: r,
                            col: c
                        });
                        onActivate === null || onActivate === void 0 ? void 0 : onActivate(r, c, item);
                    },
                    onKeyDown: (e)=>handleKey(e, r, c)
                }));
            }));
        }));
    }
    // src/shared/harthmere/mmo_building_authority_v1.ts
    var _structureRegistry = /* @__PURE__ */ new Map();
    function registerHarthmereStructureDefinitionV1(def) {
        _structureRegistry.set(def.structureTypeId, def);
    }
    (function seedBuiltinStructures() {
        const defaults = [
            {
                structureTypeId: "small_house",
                displayName: "Small House",
                footprint: {
                    width: 5,
                    depth: 5,
                    height: 4
                },
                maxSlopeDegrees: 15,
                requiredFoundationVoxels: 25,
                minSpacingToStructureVoxels: 2,
                minEntranceClearanceVoxels: 3,
                hasEntrance: true,
                requiresRoadAccess: false,
                allowedTerrainTypes: [
                    "grass",
                    "dirt",
                    "stone"
                ],
                maxHeightAboveGround: 6,
                requiredPlotType: "residential",
                minPlotAreaVoxels: 36
            },
            {
                structureTypeId: "medium_house",
                displayName: "Medium House",
                footprint: {
                    width: 8,
                    depth: 8,
                    height: 6
                },
                maxSlopeDegrees: 10,
                requiredFoundationVoxels: 64,
                minSpacingToStructureVoxels: 3,
                minEntranceClearanceVoxels: 4,
                hasEntrance: true,
                requiresRoadAccess: true,
                allowedTerrainTypes: [
                    "grass",
                    "dirt",
                    "stone"
                ],
                maxHeightAboveGround: 10,
                requiredPlotType: "residential",
                minPlotAreaVoxels: 100
            },
            {
                structureTypeId: "shop",
                displayName: "Shop",
                footprint: {
                    width: 6,
                    depth: 6,
                    height: 4
                },
                maxSlopeDegrees: 5,
                requiredFoundationVoxels: 36,
                minSpacingToStructureVoxels: 2,
                minEntranceClearanceVoxels: 4,
                hasEntrance: true,
                requiresRoadAccess: true,
                allowedTerrainTypes: [
                    "grass",
                    "dirt",
                    "stone",
                    "sand"
                ],
                maxHeightAboveGround: 8,
                requiredPlotType: "commercial",
                minPlotAreaVoxels: 64
            },
            {
                structureTypeId: "farm_plot",
                displayName: "Farm Plot",
                footprint: {
                    width: 10,
                    depth: 10,
                    height: 1
                },
                maxSlopeDegrees: 5,
                requiredFoundationVoxels: 100,
                minSpacingToStructureVoxels: 1,
                minEntranceClearanceVoxels: 2,
                hasEntrance: false,
                requiresRoadAccess: false,
                allowedTerrainTypes: [
                    "grass",
                    "dirt"
                ],
                maxHeightAboveGround: 2,
                requiredPlotType: "farm",
                minPlotAreaVoxels: 144
            },
            {
                structureTypeId: "guild_hall",
                displayName: "Guild Hall",
                footprint: {
                    width: 14,
                    depth: 14,
                    height: 8
                },
                maxSlopeDegrees: 5,
                requiredFoundationVoxels: 196,
                minSpacingToStructureVoxels: 5,
                minEntranceClearanceVoxels: 6,
                hasEntrance: true,
                requiresRoadAccess: true,
                allowedTerrainTypes: [
                    "grass",
                    "dirt",
                    "stone"
                ],
                maxHeightAboveGround: 16,
                requiredPlotType: "guild",
                minPlotAreaVoxels: 400
            },
            {
                structureTypeId: "fence",
                displayName: "Fence Segment",
                footprint: {
                    width: 1,
                    depth: 3,
                    height: 2
                },
                maxSlopeDegrees: 25,
                requiredFoundationVoxels: 3,
                minSpacingToStructureVoxels: 0,
                minEntranceClearanceVoxels: 0,
                hasEntrance: false,
                requiresRoadAccess: false,
                allowedTerrainTypes: [
                    "grass",
                    "dirt",
                    "stone",
                    "sand",
                    "snow"
                ],
                maxHeightAboveGround: 3,
                minPlotAreaVoxels: 1
            }
        ];
        for (const def of defaults){
            _structureRegistry.set(def.structureTypeId, def);
        }
    })();
    // src/shared/bikkie/ids.ts
    var BikkieIds = {
        adminAxe: 4537020877769898,
        adminRobot: 5424579032474707,
        androgenous: 1534621126189718,
        anyStone: 7539420629350051,
        arcadeMachine: 4537020877769721,
        arrowThroughHead: 4537020877770072,
        aviatorHat: 8505535949917847,
        axe: 4537020877770177,
        azaleaSeed: 1534621126189370,
        baitShrimp: 4537020877769676,
        bananaSeed: 1534621126189361,
        bboxMarker: 2874227533596773,
        beanieWithSpinner: 4537020877770150,
        bedrock: 1534621126189847,
        bellBottoms: 7539420629349958,
        bellFlowerSeed: 7539420629350027,
        bigBowRibbon: 4537020877769649,
        bigeye_tuna: 4537020877769685,
        birchDoor: 7539420629350135,
        birchSeed: 1534621126189373,
        biomesRobot: 567816707675895,
        bizzyCola: 1534621126189382,
        bling: 1534621126189715,
        blueprintAnglersTable: 8176147131639241,
        blueprintBench: 6465116931230474,
        blueprintCanopyFrame: 7868809447633355,
        blueprintCommsTower: 3243584032760191,
        blueprintComposter: 4590081419630270,
        blueprintDyeOMatic: 3085780603082451,
        blueprintFence: 663601322198230,
        blueprintKitchen: 7642096223334102,
        blueprintModernShelterFrame: 3504752154366770,
        blueprintSeedMill: 5165478204705300,
        blueprintSpaceAgeShelterFrame: 4313753143202106,
        blueprintMarinaShoppingStall: 1825420459484848,
        blueprintNetworkTower: 1056387151531327,
        blueprintTTable: 6977805803201177,
        blueprintTable: 7443636014830386,
        blueprintTailoringBooth: 1534621126189445,
        blueprintThermoblaster: 7539420629350102,
        blueprintThermolite: 5013876656537945,
        blueprintTraditionalShelterFrame: 1961861852831554,
        blueprintWorkbench: 7539420629350159,
        boombox: 4537020877769751,
        boots: 1534621126189784,
        bottoms: 4537020877770126,
        bracelet: 4537020877769607,
        branchesDoor: 4537020877769805,
        bucket: 4537020877769799,
        camera: 7539420629350492,
        campfire: 7539420629350084,
        carrotSeed: 4537020877769703,
        catEars: 6033741616908993,
        clay: 4537020877770021,
        clearwaterFish: 5289515835017799,
        clownfish: 1534621126189355,
        cobblestone: 1534621126189850,
        coffee: 7539420629350039,
        coffeeSeed: 7539420629350021,
        collectionClearwaterFish: 4568030285350437,
        collectionHidden: 306648586067057,
        collectionMuckwaterFish: 414147865674476,
        collectionPlants: 2255417577913009,
        dandelionSeed: 4537020877769697,
        deathmatchEnter: 4537020877769580,
        diamondGem: 1534621126189688,
        diamondRough: 1534621126189661,
        dirt: 4537020877770180,
        divingGoggles: 1534621126189289,
        dMucker: 6203259711678048,
        ears: 7539420629350417,
        emptyPowerCell: 456182840394405,
        environmentGroup: 7539420629350486,
        face: 4537020877770096,
        feet: 4537020877770117,
        fertilizer: 7722031585092164,
        fencer: 4537020877770162,
        fish: 7539420629350036,
        fishWallMount: 4505322372247292,
        flowerCrown: 7539420629349976,
        fruit: 5973100997645477,
        goldFrameExtraLarge: 4537020877769787,
        goldFrameLarge: 7539420629350117,
        goldNugget: 4537020877769991,
        goldOre: 4537020877770012,
        granite: 1534621126189835,
        grapeSeed: 7539420629350018,
        grass: 3588133005856146,
        grassyBottom: 7539420629350447,
        grassyTop: 7539420629350456,
        hair: 4537020877770111,
        hands: 1534621126189733,
        hat: 7539420629350483,
        hawaiiNecklace: 4537020877769613,
        head: 4537020877770048,
        homestone: 4537020877770105,
        human: 7710316920007608,
        isoCam: 1534621126189424,
        zoomCam: 733889312712469,
        kitchen: 1485695172010242,
        koi: 7539420629350012,
        lilacSeed: 7539420629350024,
        log: 1534621126189436,
        logger: 7539420629350156,
        lumber: 7539420629350093,
        mackerel: 4537020877769598,
        mailbox: 3324897590409143,
        megaAxe: 5882140068746936,
        metagameLeaderboard: 7119759980118961,
        metagameTeamLeaderboard: 7469132638841053,
        minigameLeaderboard: 7539420629349913,
        muckBuster: 6707679408294768,
        muckBusterPlaceable: 2393237167156092,
        smallLeaderboard: 8011452722498321,
        muckerMeat: 7539420629350042,
        muckerWard: 1534621126189403,
        muckSickness: 6684250078122011,
        muckwaterFish: 4832643896689956,
        muckBusterRedux: 6857902760565950,
        muckySkirt: 7539420629350447,
        muckyTop: 7539420629350456,
        neck: 1534621126189742,
        neptuniumNugget: 7539420629350318,
        npcGlobals: 8098279063715444,
        oakDoor: 1534621126189475,
        oakFrameExtraLarge: 4537020877769793,
        oakFrameLarge: 7539420629350123,
        oakFrameMedium: 1534621126189466,
        oakFrameSmall: 4537020877769796,
        oakLeaf: 4537020877770108,
        oakLog: 4537020877770174,
        oakSeed: 7539420629350030,
        ogTShirt: 2324327372530115,
        onionSeed: 7539420629350015,
        outerwear: 1534621126189814,
        parcel: 6974360313521877,
        pickaxe: 4537020877770159,
        pjBottoms: 1534621126189298,
        pjTop: 1534621126189304,
        playerGift: 5520363647038355,
        playerGiftReward: 7745460915304320,
        poncho: 1534621126189310,
        potatoSeed: 4537020877769688,
        powerCell: 3272526146499364,
        pumpkin: 7539420629350498,
        pumpkinSeed: 4537020877769718,
        punkfish: 409324180050748,
        rainbowTrout: 7539420629349925,
        raspberrySeed: 7539420629350033,
        recipePaper: 195703816729314,
        recipeStick: 5091055626506796,
        recordPlayer: 7839178235946121,
        remoteControl: 4192471904673985,
        ringWithGem: 1534621126189724,
        roseSeed: 4537020877769694,
        rubberDoor: 7539420629350132,
        rubberLeaf: 7539420629350435,
        rubberSeed: 4537020877769700,
        sakuraSeed: 614675368016114,
        salmon: 1534621126189352,
        sashimi: 8659204791920139,
        silverDoor: 4537020877769802,
        silverFrameExtraLarge: 1534621126189460,
        silverFrameLarge: 4537020877769790,
        silverFrameMedium: 7539420629350120,
        silverFrameSmall: 1534621126189463,
        silverNugget: 7539420629350321,
        simpleRaceCheckpoint: 1534621126189250,
        simpleRaceFinish: 1534621126189256,
        simpleRaceStart: 4537020877769586,
        slabber: 7539420629350489,
        slop: 6431351131865635,
        smallOakSign: 1534621126189418,
        smallShopContainer: 7539420629350114,
        sombrero: 1534621126189313,
        spikefish: 8157541487089990,
        spleefSpawn: 370045597116844,
        spleefStart: 6360374043406692,
        stepper: 1534621126189832,
        stone: 7539420629350510,
        stonePick: 7539420629350249,
        strawberrySeed: 4537020877769691,
        sunBlockers: 1534621126189763,
        superFertilizer: 791084442243108,
        superStriker: 9004442862965136,
        swimfin: 7539420629349949,
        switchGrass: 7539420629350336,
        tabler: 7539420629350324,
        tailoringBooth: 7539420629350105,
        tatteredSkirt: 1534621126189682,
        tatteredTop: 7539420629350144,
        thermoblaster: 4537020877769775,
        tilledSoil: 1534621126189391,
        tomatoSeed: 1534621126189358,
        top: 7539420629350465,
        treasureChest: 7539420629349916,
        trout: 7539420629349922,
        vegetable: 8533788965712880,
        wand: 7539420629350501,
        wardrobe: 1534621126189262,
        wheatSeed: 1534621126189364,
        woodContainer: 7539420629350138,
        woodenFencer: 7539420629350252,
        woodenSlabber: 4537020877769919,
        woodenStepper: 4537020877769916,
        workbench: 1534621126189448,
        robotModule: 4432967087898065
    };
    var WEARABLE_TYPES = [
        [
            BikkieIds.hat,
            (b)=>!!b.wearAsHat
        ],
        [
            BikkieIds.outerwear,
            (b)=>!!b.wearAsOuterwear
        ],
        [
            BikkieIds.top,
            (b)=>!!b.wearAsTop
        ],
        [
            BikkieIds.bottoms,
            (b)=>!!b.wearAsBottoms
        ],
        [
            BikkieIds.feet,
            (b)=>!!b.wearOnFeet
        ],
        [
            BikkieIds.hair,
            (b)=>!!b.wearAsHair
        ],
        [
            BikkieIds.face,
            (b)=>!!b.wearOnFace
        ],
        [
            BikkieIds.ears,
            (b)=>!!b.wearOnEars
        ],
        [
            BikkieIds.neck,
            (b)=>!!b.wearOnNeck
        ],
        [
            BikkieIds.hands,
            (b)=>!!b.wearOnHands
        ]
    ];
    var WEARABLE_SLOTS = WEARABLE_TYPES.map(([id, _fn])=>id);
    var ITEM_TYPES = new Map([
        [
            BikkieIds.anyStone,
            (b)=>!!b.isAnyStone
        ],
        [
            BikkieIds.log,
            (b)=>!!b.isLog
        ],
        [
            BikkieIds.lumber,
            (b)=>!!b.isLumber
        ],
        [
            BikkieIds.stepper,
            (b)=>!!b.isTool && b.shape === "step"
        ],
        [
            BikkieIds.slabber,
            (b)=>!!b.isTool && b.shape === "slab"
        ],
        [
            BikkieIds.fencer,
            (b)=>!!b.isTool && b.shape === "fence"
        ],
        [
            BikkieIds.axe,
            (b)=>!!b.isAxe
        ],
        [
            BikkieIds.pickaxe,
            (b)=>!!b.isPickaxe
        ],
        [
            BikkieIds.fish,
            (b)=>!!b.isFish
        ],
        [
            BikkieIds.fruit,
            (b)=>!!b.isFruit
        ],
        [
            BikkieIds.vegetable,
            (b)=>!!b.isVegetable
        ],
        [
            BikkieIds.muckwaterFish,
            (b)=>!!b.isMuckwaterFish
        ],
        [
            BikkieIds.clearwaterFish,
            (b)=>!!b.isClearwaterFish
        ],
        ...WEARABLE_TYPES
    ]);
    // src/shared/harthmere/building_system_v1.ts
    var BUILDING_SYSTEM_VERSION_V1 = "building-system-production-v5";
    var BUILDING_SYSTEM_MATERIAL_CATALOG_V1 = {
        rough_stone: {
            material: "rough_stone",
            displayName: "Rough Stone",
            itemId: String(BikkieIds.cobblestone),
            bikkieId: BikkieIds.cobblestone,
            bikkieName: "cobblestone"
        },
        river_clay: {
            material: "river_clay",
            displayName: "River Clay",
            itemId: String(BikkieIds.clay),
            bikkieId: BikkieIds.clay,
            bikkieName: "clay"
        },
        softwood_log: {
            material: "softwood_log",
            displayName: "Softwood Log",
            itemId: String(BikkieIds.log),
            bikkieId: BikkieIds.log,
            bikkieName: "log"
        },
        oak_branch: {
            material: "oak_branch",
            displayName: "Oak Branch",
            itemId: String(BikkieIds.oakLog),
            bikkieId: BikkieIds.oakLog,
            bikkieName: "oakLog"
        },
        iron_ore: {
            material: "iron_ore",
            displayName: "Metal Ore",
            itemId: String(BikkieIds.goldOre),
            bikkieId: BikkieIds.goldOre,
            bikkieName: "goldOre"
        },
        scrap_metal: {
            material: "scrap_metal",
            displayName: "Scrap Metal",
            itemId: String(BikkieIds.silverNugget),
            bikkieId: BikkieIds.silverNugget,
            bikkieName: "silverNugget"
        },
        tree_resin: {
            material: "tree_resin",
            displayName: "Tree Resin",
            itemId: String(BikkieIds.oakLeaf),
            bikkieId: BikkieIds.oakLeaf,
            bikkieName: "oakLeaf"
        },
        cloth_scrap: {
            material: "cloth_scrap",
            displayName: "Cloth Scrap",
            itemId: String(BikkieIds.tatteredTop),
            bikkieId: BikkieIds.tatteredTop,
            bikkieName: "tatteredTop"
        },
        clean_water: {
            material: "clean_water",
            displayName: "Clean Water Bucket",
            itemId: String(BikkieIds.bucket),
            bikkieId: BikkieIds.bucket,
            bikkieName: "bucket"
        },
        old_coin: {
            material: "old_coin",
            displayName: "Old Coin",
            itemId: String(BikkieIds.goldNugget),
            bikkieId: BikkieIds.goldNugget,
            bikkieName: "goldNugget"
        },
        mana_essence: {
            material: "mana_essence",
            displayName: "Mana Essence",
            itemId: String(BikkieIds.powerCell),
            bikkieId: BikkieIds.powerCell,
            bikkieName: "powerCell"
        }
    };
    var BUILDING_SYSTEM_GROVE_STEWARD_NPC_V1 = {
        id: "mira_grove_land_steward",
        displayName: "Mira Thatch, Grove Land Steward",
        idOffset: 9315,
        homeArea: "the_grove",
        role: "Land steward, plot registrar, and safe-construction permit clerk",
        position: [
            501,
            53,
            -132
        ],
        line: "Land is not safe because paper says so. It is safe when the muck is cleared, the boundary is marked, and the door opens onto a real path."
    };
    var BUILDING_SYSTEM_MIRA_INTRO_QUEST_V1 = {
        questId: "building_system_intro_talk_to_mira",
        displayName: "Meet Mira, Grove Land Steward",
        initialForNewPlayers: true,
        completionNpcId: BUILDING_SYSTEM_GROVE_STEWARD_NPC_V1.id,
        completionNpcOffset: BUILDING_SYSTEM_GROVE_STEWARD_NPC_V1.idOffset,
        stepId: "talk_to_mira",
        objective: "Talk to Mira Thatch in the Grove to learn how to buy safe land and build with voxels.",
        mapMarkerLabel: "Talk to Mira"
    };
    var BUILDING_SYSTEM_TAX_PERIOD_MS_V1 = 24 * 60 * 60 * 1e3;
    var BUILDING_SYSTEM_ABANDON_AFTER_UNPAID_TAX_MS_V1 = 14 * BUILDING_SYSTEM_TAX_PERIOD_MS_V1;
    var BUILDING_BLOCKS_V1 = {
        foundation: BikkieIds.cobblestone,
        floor: BikkieIds.stone,
        frame: BikkieIds.oakLog,
        wall: BikkieIds.cobblestone,
        roof: BikkieIds.stone,
        stair: BikkieIds.woodenStepper,
        interior: BikkieIds.woodContainer,
        safeGround: BikkieIds.dirt,
        air: 0,
        boundaryMarker: BikkieIds.woodenFencer,
        deedMarker: BikkieIds.smallOakSign,
        mapMarker: BikkieIds.bboxMarker,
        npcMarker: BikkieIds.bboxMarker,
        storageContainer: BikkieIds.woodContainer,
        doorLock: BikkieIds.smallOakSign,
        businessMarker: BikkieIds.bboxMarker,
        upgradeWall: BikkieIds.stone
    };
    function ensureBuildingSystemStructureDefinitionsV1() {
        registerHarthmereStructureDefinitionV1({
            structureTypeId: "workshop",
            displayName: "Workshop",
            footprint: {
                width: 8,
                depth: 7,
                height: 5
            },
            maxSlopeDegrees: 8,
            requiredFoundationVoxels: 56,
            minSpacingToStructureVoxels: 3,
            minEntranceClearanceVoxels: 4,
            hasEntrance: true,
            requiresRoadAccess: true,
            allowedTerrainTypes: [
                "grass",
                "dirt",
                "stone"
            ],
            maxHeightAboveGround: 10,
            requiredPlotType: "crafting",
            minPlotAreaVoxels: 96
        });
        registerHarthmereStructureDefinitionV1({
            structureTypeId: "warehouse",
            displayName: "Warehouse",
            footprint: {
                width: 10,
                depth: 8,
                height: 6
            },
            maxSlopeDegrees: 6,
            requiredFoundationVoxels: 80,
            minSpacingToStructureVoxels: 3,
            minEntranceClearanceVoxels: 5,
            hasEntrance: true,
            requiresRoadAccess: true,
            allowedTerrainTypes: [
                "grass",
                "dirt",
                "stone",
                "sand"
            ],
            maxHeightAboveGround: 12,
            requiredPlotType: "commercial",
            minPlotAreaVoxels: 120
        });
        registerHarthmereStructureDefinitionV1({
            structureTypeId: "large_house",
            displayName: "Large House",
            footprint: {
                width: 11,
                depth: 10,
                height: 7
            },
            maxSlopeDegrees: 8,
            requiredFoundationVoxels: 110,
            minSpacingToStructureVoxels: 4,
            minEntranceClearanceVoxels: 5,
            hasEntrance: true,
            requiresRoadAccess: true,
            allowedTerrainTypes: [
                "grass",
                "dirt",
                "stone"
            ],
            maxHeightAboveGround: 14,
            requiredPlotType: "residential",
            minPlotAreaVoxels: 180
        });
    }
    function buildingSystemDefaultOriginV1(plot, blueprint) {
        return {
            x: Math.floor((plot.bounds.xMin + plot.bounds.xMax - blueprint.footprint.width) / 2),
            y: plot.groundY + 1,
            z: Math.floor((plot.bounds.zMin + plot.bounds.zMax - blueprint.footprint.depth) / 2)
        };
    }
    function pushVoxelBox(edits, min, maxExclusive, value, label) {
        for(let x = min[0]; x < maxExclusive[0]; x++){
            for(let y = min[1]; y < maxExclusive[1]; y++){
                for(let z = min[2]; z < maxExclusive[2]; z++){
                    edits.push({
                        kind: "editEvent",
                        position: [
                            x,
                            y,
                            z
                        ],
                        value,
                        label
                    });
                }
            }
        }
    }
    function pushBuildingWallsV1(input) {
        const doorX = Math.floor((input.x0 + input.x1) / 2);
        for(let y = input.y0 + 1; y < input.wallTop; y++){
            for(let x = input.x0; x < input.x1; x++){
                const isDoor = x === doorX && (y === input.y0 + 1 || y === input.y0 + 2);
                if (!isDoor) {
                    input.edits.push({
                        kind: "editEvent",
                        position: [
                            x,
                            y,
                            input.z0
                        ],
                        value: BUILDING_BLOCKS_V1.wall,
                        label: "wall"
                    });
                }
                input.edits.push({
                    kind: "editEvent",
                    position: [
                        x,
                        y,
                        input.z1 - 1
                    ],
                    value: BUILDING_BLOCKS_V1.wall,
                    label: "wall"
                });
            }
            for(let z = input.z0 + 1; z < input.z1 - 1; z++){
                input.edits.push({
                    kind: "editEvent",
                    position: [
                        input.x0,
                        y,
                        z
                    ],
                    value: BUILDING_BLOCKS_V1.wall,
                    label: "wall"
                });
                input.edits.push({
                    kind: "editEvent",
                    position: [
                        input.x1 - 1,
                        y,
                        z
                    ],
                    value: BUILDING_BLOCKS_V1.wall,
                    label: "wall"
                });
            }
        }
    }
    function buildingSystemGeometryBoundsV1(plot, blueprint, origin) {
        const resolvedOrigin = origin !== null && origin !== void 0 ? origin : buildingSystemDefaultOriginV1(plot, blueprint);
        const fp = blueprint.footprint;
        const x0 = resolvedOrigin.x;
        const z0 = resolvedOrigin.z;
        const y0 = resolvedOrigin.y;
        const x1 = x0 + fp.width;
        const z1 = z0 + fp.depth;
        const wallTop = y0 + Math.max(3, fp.height - 1);
        const roofY = wallTop;
        return {
            origin: resolvedOrigin,
            fp,
            x0,
            y0,
            z0,
            x1,
            z1,
            wallTop,
            roofY
        };
    }
    function createBuildingSystemMaterializationPlanV1(input) {
        const { origin , x0 , z0 , y0 , x1 , z1 , wallTop , roofY  } = buildingSystemGeometryBoundsV1(input.plot, input.blueprint, input.origin);
        const edits = [];
        if (input.includeSafeGround && input.plot.safeAfterPurchase) {
            pushVoxelBox(edits, [
                input.plot.bounds.xMin,
                input.plot.groundY,
                input.plot.bounds.zMin
            ], [
                input.plot.bounds.xMax,
                input.plot.groundY + 1,
                input.plot.bounds.zMax
            ], BUILDING_BLOCKS_V1.safeGround, "safe_ground");
        }
        pushVoxelBox(edits, [
            x0,
            y0 - 1,
            z0
        ], [
            x1,
            y0,
            z1
        ], BUILDING_BLOCKS_V1.foundation, "foundation");
        pushVoxelBox(edits, [
            x0,
            y0,
            z0
        ], [
            x1,
            y0 + 1,
            z1
        ], BUILDING_BLOCKS_V1.floor, "floor");
        pushBuildingWallsV1({
            edits,
            x0,
            x1,
            y0,
            z0,
            z1,
            wallTop
        });
        pushVoxelBox(edits, [
            x0,
            roofY,
            z0
        ], [
            x1,
            roofY + 1,
            z1
        ], BUILDING_BLOCKS_V1.roof, "roof");
        const doorX = Math.floor((x0 + x1) / 2);
        const stairZ = z0 - 1;
        if (stairZ >= input.plot.bounds.zMin && doorX >= input.plot.bounds.xMin && doorX < input.plot.bounds.xMax) {
            edits.push({
                kind: "editEvent",
                position: [
                    doorX,
                    y0,
                    stairZ
                ],
                value: BUILDING_BLOCKS_V1.stair,
                label: "stair"
            });
        }
        var _input_rotationDegrees;
        return {
            version: BUILDING_SYSTEM_VERSION_V1,
            requestId: input.requestId,
            actorId: input.actorId,
            plotId: input.plot.plotId,
            blueprintId: input.blueprint.blueprintId,
            structureTypeId: input.blueprint.structureTypeId,
            use: input.blueprint.use,
            origin,
            rotationDegrees: (_input_rotationDegrees = input.rotationDegrees) !== null && _input_rotationDegrees !== void 0 ? _input_rotationDegrees : 0,
            edits,
            placeGroup: {
                kind: "placeGroupEvent",
                name: `${input.plot.displayName} ${input.blueprint.displayName}`,
                box: {
                    v0: [
                        x0,
                        y0 - 1,
                        z0
                    ],
                    v1: [
                        x1,
                        roofY + 1,
                        z1
                    ]
                },
                reason: "building_blueprint_materialized"
            },
            safeZone: input.plot.safeAfterPurchase ? {
                plotId: input.plot.plotId,
                actorId: input.actorId,
                area: input.plot.area,
                bounds: input.plot.bounds,
                safeFromMuck: true,
                activatedAtMs: input.activatedAtMs
            } : void 0,
            materializesSolidVoxelBuilding: true
        };
    }
    ensureBuildingSystemStructureDefinitionsV1();
    // src/shared/harthmere/business_customer_simulator_v1.ts
    var CUSTOMER_ROWS = [
        [
            "customer_adria_vale",
            "Adria Vale",
            [
                "medical_doctor",
                "magic_goods"
            ],
            72,
            3,
            "precise",
            {
                hairStyle: "asymmetric coil bob",
                hairColor: "smoked copper",
                bodyBuild: "compact sprinter",
                heightBand: "short-plus",
                shoulderShape: "narrow square",
                posture: "upright alert",
                gait: "quick half-steps",
                eyeColor: "jade fleck",
                eyeShape: "wide almond",
                browShape: "single high arch",
                noseShape: "button point",
                noseBridge: "soft low bridge",
                skinTone: "warm umber rose",
                outfit: "moss clinic wrap",
                accessory: "brass pulse ring",
                voice: "low clipped alto"
            }
        ],
        [
            "customer_borin_kest",
            "Borin Kest",
            [
                "weapons_tools",
                "repair_maintenance_person"
            ],
            64,
            2,
            "skeptical",
            {
                hairStyle: "shaved crown braid",
                hairColor: "iron black",
                bodyBuild: "barrel strong",
                heightBand: "tall",
                shoulderShape: "broad shelf",
                posture: "forward lean",
                gait: "heavy heel roll",
                eyeColor: "storm gray",
                eyeShape: "deep set",
                browShape: "flat thick",
                noseShape: "broken ridge",
                noseBridge: "crooked high bridge",
                skinTone: "cool tawny",
                outfit: "charcoal work apron",
                accessory: "cracked thumb guard",
                voice: "gravel bass"
            }
        ],
        [
            "customer_celia_morn",
            "Celia Morn",
            [
                "food_service_restaurant",
                "hospitality_inn_hotel_shelter"
            ],
            84,
            4,
            "warm",
            {
                hairStyle: "halo curls",
                hairColor: "honey ash",
                bodyBuild: "soft pear",
                heightBand: "mid",
                shoulderShape: "rounded narrow",
                posture: "gentle sway",
                gait: "measured glide",
                eyeColor: "violet brown",
                eyeShape: "sleepy oval",
                browShape: "soft crescent",
                noseShape: "small scoop",
                noseBridge: "delicate bridge",
                skinTone: "deep bronze gold",
                outfit: "cream travel shawl",
                accessory: "enameled spoon pin",
                voice: "singing mezzo"
            }
        ],
        [
            "customer_dain_orrick",
            "Dain Orrick",
            [
                "courier",
                "general_trader"
            ],
            58,
            2,
            "impatient",
            {
                hairStyle: "windcut spikes",
                hairColor: "sun bleached brown",
                bodyBuild: "lean courier",
                heightBand: "mid-tall",
                shoulderShape: "sloped wiry",
                posture: "ready crouch",
                gait: "fast toe push",
                eyeColor: "pale hazel",
                eyeShape: "sharp narrow",
                browShape: "angled slash",
                noseShape: "long hawk",
                noseBridge: "straight high bridge",
                skinTone: "olive tan",
                outfit: "blue parcel vest",
                accessory: "tin route whistle",
                voice: "bright tenor"
            }
        ],
        [
            "customer_elira_senn",
            "Elira Senn",
            [
                "biome_design_studio",
                "custom_home_property_development"
            ],
            76,
            4,
            "curious",
            {
                hairStyle: "looped side bun",
                hairColor: "black cherry",
                bodyBuild: "willow slim",
                heightBand: "tall-slim",
                shoulderShape: "fine tapered",
                posture: "tilted assessing",
                gait: "long quiet stride",
                eyeColor: "sea glass",
                eyeShape: "cat tilt",
                browShape: "thin lifted",
                noseShape: "straight fine",
                noseBridge: "long smooth bridge",
                skinTone: "amber beige",
                outfit: "ink drafting coat",
                accessory: "silver measuring chain",
                voice: "clear contralto"
            }
        ],
        [
            "customer_fenn_barley",
            "Fenn Barley",
            [
                "biome_farming_rare_foods",
                "general_trader"
            ],
            70,
            2,
            "cheerful",
            {
                hairStyle: "short leaf twists",
                hairColor: "chestnut greenwash",
                bodyBuild: "stocky farmhand",
                heightBand: "short",
                shoulderShape: "round solid",
                posture: "hands-on-hips",
                gait: "bouncy step",
                eyeColor: "fern green",
                eyeShape: "round bright",
                browShape: "bushy comma",
                noseShape: "wide bulb",
                noseBridge: "flat broad bridge",
                skinTone: "red clay brown",
                outfit: "patchwork seed smock",
                accessory: "woven seed bracelet",
                voice: "sunny baritone"
            }
        ],
        [
            "customer_garrin_vox",
            "Garrin Vox",
            [
                "security_defense_contractor",
                "weapons_tools"
            ],
            62,
            3,
            "guarded",
            {
                hairStyle: "tight military crop",
                hairColor: "salt pepper",
                bodyBuild: "triangular guard",
                heightBand: "very tall",
                shoulderShape: "armor wide",
                posture: "locked stance",
                gait: "patrol pace",
                eyeColor: "steel blue",
                eyeShape: "hooded narrow",
                browShape: "hard shelf",
                noseShape: "flat boxer",
                noseBridge: "scarred bridge",
                skinTone: "cool dark brown",
                outfit: "oiled leather jerkin",
                accessory: "red permit cord",
                voice: "command baritone"
            }
        ],
        [
            "customer_hessa_quin",
            "Hessa Quin",
            [
                "magic_goods",
                "teleport_owner"
            ],
            68,
            5,
            "mysterious",
            {
                hairStyle: "waist rope locs",
                hairColor: "moon white",
                bodyBuild: "lithe dancer",
                heightBand: "mid-short",
                shoulderShape: "thin angular",
                posture: "floating still",
                gait: "silent crossing",
                eyeColor: "silver lilac",
                eyeShape: "long crescent",
                browShape: "split notch",
                noseShape: "narrow blade",
                noseBridge: "raised knife bridge",
                skinTone: "cool ebony",
                outfit: "violet ward robe",
                accessory: "glass charm veil",
                voice: "soft whisper"
            }
        ],
        [
            "customer_idra_pell",
            "Idra Pell",
            [
                "portal_transit_company",
                "courier"
            ],
            56,
            3,
            "anxious",
            {
                hairStyle: "frizzed cloud puff",
                hairColor: "rust red",
                bodyBuild: "small angular",
                heightBand: "petite",
                shoulderShape: "pinched narrow",
                posture: "shoulders high",
                gait: "stutter step",
                eyeColor: "amber ring",
                eyeShape: "large worried",
                browShape: "knit double peak",
                noseShape: "upturned spark",
                noseBridge: "short lifted bridge",
                skinTone: "light freckled tan",
                outfit: "yellow ticket cloak",
                accessory: "paper luggage tags",
                voice: "quick soprano"
            }
        ],
        [
            "customer_jorek_linn",
            "Jorek Linn",
            [
                "waste_sanitation_cleanup",
                "medical_doctor"
            ],
            60,
            2,
            "blunt",
            {
                hairStyle: "low knot tail",
                hairColor: "mud brown",
                bodyBuild: "rectangular laborer",
                heightBand: "mid-wide",
                shoulderShape: "flat plank",
                posture: "tired stoop",
                gait: "dragged boot",
                eyeColor: "dull teal",
                eyeShape: "heavy lidded",
                browShape: "low ridge",
                noseShape: "wide wedge",
                noseBridge: "broad broken bridge",
                skinTone: "weathered sand",
                outfit: "stained utility coat",
                accessory: "corked sample tube",
                voice: "dry bass"
            }
        ],
        [
            "customer_kiva_roan",
            "Kiva Roan",
            [
                "exploration_guide",
                "hunter_wild_meat"
            ],
            66,
            3,
            "bold",
            {
                hairStyle: "feathered undercut",
                hairColor: "black blue sheen",
                bodyBuild: "rangy climber",
                heightBand: "tall-rangy",
                shoulderShape: "corded narrow",
                posture: "chin forward",
                gait: "spring climb",
                eyeColor: "gold ocher",
                eyeShape: "fox narrow",
                browShape: "split high",
                noseShape: "sharp point",
                noseBridge: "thin ridge",
                skinTone: "copper brown",
                outfit: "green trail harness",
                accessory: "bone map toggle",
                voice: "laughing alto"
            }
        ],
        [
            "customer_luca_merrit",
            "Luca Merrit",
            [
                "hospitality_inn_hotel_shelter",
                "food_service_restaurant"
            ],
            88,
            4,
            "polite",
            {
                hairStyle: "side parted waves",
                hairColor: "soft black",
                bodyBuild: "rounded scholar",
                heightBand: "mid-soft",
                shoulderShape: "soft square",
                posture: "formal bow",
                gait: "small careful",
                eyeColor: "dark honey",
                eyeShape: "gentle almond",
                browShape: "tidy arc",
                noseShape: "roman soft",
                noseBridge: "smooth medium bridge",
                skinTone: "golden brown",
                outfit: "wine guest jacket",
                accessory: "pearl room key",
                voice: "warm tenor"
            }
        ],
        [
            "customer_mirae_dusk",
            "Mirae Dusk",
            [
                "biome_maintenance_repair",
                "exotic_matter_refinery"
            ],
            54,
            5,
            "demanding",
            {
                hairStyle: "slick prism bob",
                hairColor: "violet black",
                bodyBuild: "tall blade",
                heightBand: "towering",
                shoulderShape: "razor straight",
                posture: "perfect vertical",
                gait: "crisp metronome",
                eyeColor: "ice violet",
                eyeShape: "thin oval",
                browShape: "needle arch",
                noseShape: "aquiline",
                noseBridge: "polished high bridge",
                skinTone: "deep neutral brown",
                outfit: "white inspector coat",
                accessory: "obsidian seal badge",
                voice: "cool alto"
            }
        ],
        [
            "customer_nalo_brix",
            "Nalo Brix",
            [
                "repair_maintenance_person",
                "custom_home_property_development"
            ],
            74,
            2,
            "practical",
            {
                hairStyle: "square brush top",
                hairColor: "dust blond",
                bodyBuild: "short dense",
                heightBand: "short-dense",
                shoulderShape: "blocky compact",
                posture: "elbows out",
                gait: "steady stomp",
                eyeColor: "brown green",
                eyeShape: "small round",
                browShape: "thick straight",
                noseShape: "stub square",
                noseBridge: "low square bridge",
                skinTone: "pale olive",
                outfit: "tan nail pouch",
                accessory: "wooden pencil earclip",
                voice: "matter-of-fact bass"
            }
        ],
        [
            "customer_ona_fleck",
            "Ona Fleck",
            [
                "general_trader",
                "biome_farming_rare_foods"
            ],
            80,
            1,
            "bargaining",
            {
                hairStyle: "tiny twin buns",
                hairColor: "silver brown",
                bodyBuild: "birdlike light",
                heightBand: "small",
                shoulderShape: "fine round",
                posture: "leaning listen",
                gait: "skipping shuffle",
                eyeColor: "black pearl",
                eyeShape: "round quick",
                browShape: "short dash",
                noseShape: "pinched bead",
                noseBridge: "tiny bridge",
                skinTone: "warm ivory",
                outfit: "striped market coat",
                accessory: "copper coin sash",
                voice: "raspy mezzo"
            }
        ],
        [
            "customer_pavo_ren",
            "Pavo Ren",
            [
                "portal_transit_company",
                "teleport_owner"
            ],
            50,
            5,
            "urgent",
            {
                hairStyle: "gelled crest",
                hairColor: "platinum yellow",
                bodyBuild: "athletic narrow",
                heightBand: "mid-athletic",
                shoulderShape: "cut diamond",
                posture: "weight forward",
                gait: "long rush",
                eyeColor: "electric blue",
                eyeShape: "bright slit",
                browShape: "twin hooks",
                noseShape: "long spear",
                noseBridge: "straight narrow bridge",
                skinTone: "light golden",
                outfit: "red travel suit",
                accessory: "stacked transit passes",
                voice: "rapid tenor"
            }
        ],
        [
            "customer_quilla_fern",
            "Quilla Fern",
            [
                "biome_design_studio",
                "magic_goods"
            ],
            86,
            3,
            "delighted",
            {
                hairStyle: "braided crown",
                hairColor: "moss brown",
                bodyBuild: "curved compact",
                heightBand: "mid-curvy",
                shoulderShape: "soft sloping",
                posture: "open hands",
                gait: "gentle bounce",
                eyeColor: "mint gray",
                eyeShape: "soft round",
                browShape: "leaf curve",
                noseShape: "rounded petal",
                noseBridge: "soft narrow bridge",
                skinTone: "deep warm beige",
                outfit: "paint flecked poncho",
                accessory: "pressed flower brooch",
                voice: "bright alto"
            }
        ],
        [
            "customer_ryx_mallow",
            "Ryx Mallow",
            [
                "security_defense_contractor",
                "exploration_guide"
            ],
            48,
            3,
            "reckless",
            {
                hairStyle: "messy wolf cut",
                hairColor: "ash brown",
                bodyBuild: "bony quick",
                heightBand: "mid-bony",
                shoulderShape: "jagged narrow",
                posture: "restless twist",
                gait: "zigzag stride",
                eyeColor: "rust amber",
                eyeShape: "uneven squint",
                browShape: "wild jag",
                noseShape: "crooked hook",
                noseBridge: "bent mid bridge",
                skinTone: "sunburnt peach",
                outfit: "torn scout cape",
                accessory: "dented compass",
                voice: "cracked tenor"
            }
        ],
        [
            "customer_sable_ior",
            "Sable Ior",
            [
                "exotic_matter_refinery",
                "waste_sanitation_cleanup"
            ],
            52,
            4,
            "cautious",
            {
                hairStyle: "shielded veil locks",
                hairColor: "charcoal purple",
                bodyBuild: "protective padded",
                heightBand: "mid-padded",
                shoulderShape: "rounded armored",
                posture: "guarded hunch",
                gait: "careful plant",
                eyeColor: "green gold",
                eyeShape: "covered narrow",
                browShape: "masked flat",
                noseShape: "soft wedge",
                noseBridge: "covered bridge",
                skinTone: "cool umber",
                outfit: "sealed gray smock",
                accessory: "filter mask",
                voice: "muffled alto"
            }
        ],
        [
            "customer_tavin_coil",
            "Tavin Coil",
            [
                "weapons_tools",
                "hunter_wild_meat"
            ],
            69,
            2,
            "confident",
            {
                hairStyle: "long tied topknot",
                hairColor: "dark auburn",
                bodyBuild: "corded hunter",
                heightBand: "tall-lean",
                shoulderShape: "sinew slope",
                posture: "relaxed ready",
                gait: "quiet heel",
                eyeColor: "pine green",
                eyeShape: "watchful almond",
                browShape: "low angled",
                noseShape: "broad straight",
                noseBridge: "weathered bridge",
                skinTone: "brown copper",
                outfit: "hide patched vest",
                accessory: "antler clasp",
                voice: "easy baritone"
            }
        ],
        [
            "customer_uma_slate",
            "Uma Slate",
            [
                "custom_home_property_development",
                "repair_maintenance_person"
            ],
            82,
            5,
            "exacting",
            {
                hairStyle: "severe center braid",
                hairColor: "blue gray",
                bodyBuild: "statuesque",
                heightBand: "tall-still",
                shoulderShape: "marble square",
                posture: "survey stance",
                gait: "slow decisive",
                eyeColor: "black blue",
                eyeShape: "calm hooded",
                browShape: "straight fine",
                noseShape: "long roman",
                noseBridge: "high flat bridge",
                skinTone: "dark cool tan",
                outfit: "architect linen suit",
                accessory: "ivory plan tube",
                voice: "measured contralto"
            }
        ],
        [
            "customer_vireo_tan",
            "Vireo Tan",
            [
                "biome_farming_rare_foods",
                "food_service_restaurant"
            ],
            78,
            3,
            "hungry",
            {
                hairStyle: "curly side shave",
                hairColor: "kelp green",
                bodyBuild: "round strong",
                heightBand: "short-round",
                shoulderShape: "curved broad",
                posture: "belly laugh",
                gait: "rolling stride",
                eyeColor: "warm brown",
                eyeShape: "crescent smile",
                browShape: "happy arc",
                noseShape: "round broad",
                noseBridge: "short broad bridge",
                skinTone: "medium olive gold",
                outfit: "orange tasting vest",
                accessory: "wooden fork charm",
                voice: "booming alto"
            }
        ],
        [
            "customer_wen_auster",
            "Wen Auster",
            [
                "courier",
                "medical_doctor"
            ],
            59,
            1,
            "worried",
            {
                hairStyle: "flat cap fringe",
                hairColor: "matte black",
                bodyBuild: "thin wiry",
                heightBand: "short-wiry",
                shoulderShape: "tight raised",
                posture: "folded arms",
                gait: "nervous patter",
                eyeColor: "brown black",
                eyeShape: "small oval",
                browShape: "pinched peak",
                noseShape: "narrow knob",
                noseBridge: "fine uneven bridge",
                skinTone: "pale tan",
                outfit: "patched runner coat",
                accessory: "medicine pouch",
                voice: "thin tenor"
            }
        ],
        [
            "customer_xara_lune",
            "Xara Lune",
            [
                "magic_goods",
                "biome_design_studio"
            ],
            90,
            5,
            "glamorous",
            {
                hairStyle: "crystal waterfall",
                hairColor: "opal silver",
                bodyBuild: "tall elegant",
                heightBand: "very tall slim",
                shoulderShape: "long sloped",
                posture: "stage poise",
                gait: "slow float",
                eyeColor: "rose quartz",
                eyeShape: "dramatic almond",
                browShape: "painted sweep",
                noseShape: "fine aquiline",
                noseBridge: "glitter high bridge",
                skinTone: "rich mahogany",
                outfit: "black star cloak",
                accessory: "floating bead chain",
                voice: "velvet soprano"
            }
        ],
        [
            "customer_yori_pike",
            "Yori Pike",
            [
                "hunter_wild_meat",
                "food_service_restaurant"
            ],
            61,
            2,
            "plainspoken",
            {
                hairStyle: "rough bowl crop",
                hairColor: "straw gold",
                bodyBuild: "broad compact",
                heightBand: "mid-stocky",
                shoulderShape: "thick round",
                posture: "one hip lean",
                gait: "muddy shuffle",
                eyeColor: "mud hazel",
                eyeShape: "flat oval",
                browShape: "rough bar",
                noseShape: "wide snub",
                noseBridge: "low snub bridge",
                skinTone: "pink tan",
                outfit: "brown butcher wrap",
                accessory: "bone tally cord",
                voice: "nasal baritone"
            }
        ],
        [
            "customer_zella_root",
            "Zella Root",
            [
                "waste_sanitation_cleanup",
                "biome_farming_rare_foods"
            ],
            73,
            1,
            "patient",
            {
                hairStyle: "wrapped seed scarf",
                hairColor: "hidden sable",
                bodyBuild: "elder small",
                heightBand: "elder short",
                shoulderShape: "narrow bent",
                posture: "soft stoop",
                gait: "careful cane tap",
                eyeColor: "cloud gray",
                eyeShape: "wrinkled kind",
                browShape: "white wisps",
                noseShape: "round elder",
                noseBridge: "soft sunken bridge",
                skinTone: "deep chestnut",
                outfit: "green compost shawl",
                accessory: "carved cane",
                voice: "gentle rasp"
            }
        ],
        [
            "customer_alen_mire",
            "Alen Mire",
            [
                "general_trader",
                "courier"
            ],
            57,
            2,
            "shifty",
            {
                hairStyle: "greased side curls",
                hairColor: "dark copper",
                bodyBuild: "thin foxlike",
                heightBand: "mid-thin",
                shoulderShape: "sharp narrow",
                posture: "sideways lean",
                gait: "sidestep saunter",
                eyeColor: "yellow hazel",
                eyeShape: "side glance",
                browShape: "one raised",
                noseShape: "pointed sly",
                noseBridge: "thin crooked bridge",
                skinTone: "light brown olive",
                outfit: "purple bargain coat",
                accessory: "hidden pocket chain",
                voice: "silky tenor"
            }
        ],
        [
            "customer_brynn_salt",
            "Brynn Salt",
            [
                "hospitality_inn_hotel_shelter",
                "courier"
            ],
            81,
            3,
            "road-worn",
            {
                hairStyle: "salt stiff braid",
                hairColor: "sand white",
                bodyBuild: "square traveler",
                heightBand: "mid-square",
                shoulderShape: "pack broad",
                posture: "pack brace",
                gait: "long tired march",
                eyeColor: "sea blue gray",
                eyeShape: "creased narrow",
                browShape: "sun faded",
                noseShape: "windburnt long",
                noseBridge: "sun cracked bridge",
                skinTone: "wind reddened tan",
                outfit: "blue travel duster",
                accessory: "shell luggage tag",
                voice: "hoarse alto"
            }
        ],
        [
            "customer_corso_helm",
            "Corso Helm",
            [
                "security_defense_contractor",
                "portal_transit_company"
            ],
            53,
            4,
            "official",
            {
                hairStyle: "helmet flattened crop",
                hairColor: "brown silver",
                bodyBuild: "thick necked",
                heightBand: "tall-thick",
                shoulderShape: "plate wide",
                posture: "hands clasped",
                gait: "inspection march",
                eyeColor: "slate green",
                eyeShape: "hard oval",
                browShape: "square block",
                noseShape: "square long",
                noseBridge: "heavy bridge",
                skinTone: "dark olive",
                outfit: "blue authority tabard",
                accessory: "bronze clearance seal",
                voice: "formal bass"
            }
        ],
        [
            "customer_dovea_rill",
            "Dovea Rill",
            [
                "biome_design_studio",
                "hospitality_inn_hotel_shelter"
            ],
            92,
            5,
            "luxury",
            {
                hairStyle: "pearled finger waves",
                hairColor: "black pearl",
                bodyBuild: "soft tall",
                heightBand: "tall-soft",
                shoulderShape: "silk sloped",
                posture: "relaxed regal",
                gait: "slow heel glide",
                eyeColor: "deep plum",
                eyeShape: "languid almond",
                browShape: "perfect crescent",
                noseShape: "small aristocrat",
                noseBridge: "fine high bridge",
                skinTone: "warm deep brown",
                outfit: "white guest mantle",
                accessory: "jade scent vial",
                voice: "low musical"
            }
        ],
        [
            "customer_ekko_jar",
            "Ekko Jar",
            [
                "repair_maintenance_person",
                "weapons_tools"
            ],
            63,
            1,
            "fidgety",
            {
                hairStyle: "uneven mop",
                hairColor: "dirty blond",
                bodyBuild: "small square",
                heightBand: "short-square",
                shoulderShape: "tight block",
                posture: "tool clutch",
                gait: "quick hop",
                eyeColor: "blue hazel",
                eyeShape: "blink round",
                browShape: "patchy dash",
                noseShape: "tiny bent",
                noseBridge: "bumped little bridge",
                skinTone: "fair freckle",
                outfit: "patched gray jumper",
                accessory: "loose screw necklace",
                voice: "squeaky tenor"
            }
        ],
        [
            "customer_fara_nox",
            "Fara Nox",
            [
                "magic_goods",
                "medical_doctor"
            ],
            67,
            4,
            "clinical",
            {
                hairStyle: "black ribbon queue",
                hairColor: "ink black",
                bodyBuild: "long narrow",
                heightBand: "mid-long",
                shoulderShape: "knife narrow",
                posture: "hands folded",
                gait: "silent measured",
                eyeColor: "green black",
                eyeShape: "half moon",
                browShape: "razor fine",
                noseShape: "thin long",
                noseBridge: "needle bridge",
                skinTone: "cool brown",
                outfit: "green remedy dress",
                accessory: "silver vial bandolier",
                voice: "quiet contralto"
            }
        ],
        [
            "customer_gillo_reed",
            "Gillo Reed",
            [
                "biome_farming_rare_foods",
                "waste_sanitation_cleanup"
            ],
            75,
            2,
            "earthy",
            {
                hairStyle: "mud tied pigtail",
                hairColor: "red brown",
                bodyBuild: "wide farm strong",
                heightBand: "wide-short",
                shoulderShape: "rounded heavy",
                posture: "relaxed slouch",
                gait: "field plod",
                eyeColor: "moss amber",
                eyeShape: "soft squint",
                browShape: "thick mossy",
                noseShape: "wide flat",
                noseBridge: "flat sun bridge",
                skinTone: "deep russet",
                outfit: "green waterproof bib",
                accessory: "seed tin",
                voice: "slow bass"
            }
        ],
        [
            "customer_hollis_vein",
            "Hollis Vein",
            [
                "exotic_matter_refinery",
                "portal_transit_company"
            ],
            51,
            5,
            "technical",
            {
                hairStyle: "silver temple sweep",
                hairColor: "graphite silver",
                bodyBuild: "thin engineer",
                heightBand: "mid-engineer",
                shoulderShape: "slight angular",
                posture: "head tilted",
                gait: "calculated steps",
                eyeColor: "blue white",
                eyeShape: "magnified round",
                browShape: "fine straight",
                noseShape: "long narrow",
                noseBridge: "spectacled bridge",
                skinTone: "light umber",
                outfit: "black hazard suit",
                accessory: "lens array monocle",
                voice: "precise tenor"
            }
        ],
        [
            "customer_iona_prax",
            "Iona Prax",
            [
                "custom_home_property_development",
                "general_trader"
            ],
            79,
            3,
            "organized",
            {
                hairStyle: "stacked box braids",
                hairColor: "warm black",
                bodyBuild: "strong hourglass",
                heightBand: "mid-curved",
                shoulderShape: "balanced square",
                posture: "clipboard ready",
                gait: "purposeful stride",
                eyeColor: "copper green",
                eyeShape: "focused almond",
                browShape: "straight tidy",
                noseShape: "medium round",
                noseBridge: "smooth broad bridge",
                skinTone: "deep gold brown",
                outfit: "navy planning vest",
                accessory: "map clasp",
                voice: "steady mezzo"
            }
        ],
        [
            "customer_jessa_mint",
            "Jessa Mint",
            [
                "food_service_restaurant",
                "biome_farming_rare_foods"
            ],
            87,
            2,
            "playful",
            {
                hairStyle: "mint ribbon ponytail",
                hairColor: "brown mint streak",
                bodyBuild: "small buoyant",
                heightBand: "petite-bouncy",
                shoulderShape: "soft tiny",
                posture: "rocking toes",
                gait: "swing step",
                eyeColor: "light green",
                eyeShape: "spark round",
                browShape: "curly comma",
                noseShape: "tiny round",
                noseBridge: "button bridge",
                skinTone: "light warm tan",
                outfit: "pink tasting frock",
                accessory: "candy bead bracelet",
                voice: "bright soprano"
            }
        ],
        [
            "customer_kelm_void",
            "Kelm Void",
            [
                "teleport_owner",
                "magic_goods"
            ],
            46,
            5,
            "strange",
            {
                hairStyle: "floating static fray",
                hairColor: "blue black",
                bodyBuild: "tall gaunt",
                heightBand: "gaunt tall",
                shoulderShape: "thin high",
                posture: "off-center still",
                gait: "uneven drift",
                eyeColor: "void violet",
                eyeShape: "unblinking round",
                browShape: "absent pale",
                noseShape: "long hollow",
                noseBridge: "shadowed bridge",
                skinTone: "ashen brown",
                outfit: "dark return cloak",
                accessory: "glowing wrist token",
                voice: "echoing whisper"
            }
        ],
        [
            "customer_lara_steel",
            "Lara Steel",
            [
                "weapons_tools",
                "security_defense_contractor"
            ],
            65,
            4,
            "direct",
            {
                hairStyle: "braided mohawk",
                hairColor: "steel gray",
                bodyBuild: "muscular tall",
                heightBand: "tall-muscular",
                shoulderShape: "warrior broad",
                posture: "square stance",
                gait: "drill step",
                eyeColor: "dark blue",
                eyeShape: "level stare",
                browShape: "stern wedge",
                noseShape: "strong straight",
                noseBridge: "solid bridge",
                skinTone: "medium cool brown",
                outfit: "red forge leathers",
                accessory: "iron rank cuff",
                voice: "firm alto"
            }
        ],
        [
            "customer_mikko_ash",
            "Mikko Ash",
            [
                "waste_sanitation_cleanup",
                "repair_maintenance_person"
            ],
            71,
            1,
            "tired",
            {
                hairStyle: "ash dust buzz",
                hairColor: "powder gray",
                bodyBuild: "thin bent",
                heightBand: "mid-bent",
                shoulderShape: "drooped slim",
                posture: "weary curve",
                gait: "slow slide",
                eyeColor: "brown gray",
                eyeShape: "tired pouch",
                browShape: "faint line",
                noseShape: "soft long",
                noseBridge: "low tired bridge",
                skinTone: "smoky beige",
                outfit: "gray mop coat",
                accessory: "rag bundle",
                voice: "soft bass"
            }
        ],
        [
            "customer_nessa_gate",
            "Nessa Gate",
            [
                "portal_transit_company",
                "hospitality_inn_hotel_shelter"
            ],
            55,
            3,
            "lost",
            {
                hairStyle: "loose travel braid",
                hairColor: "red gold",
                bodyBuild: "tall narrow",
                heightBand: "tall-narrow",
                shoulderShape: "pack sloped",
                posture: "map hunched",
                gait: "stop-start walk",
                eyeColor: "blue hazel",
                eyeShape: "wide searching",
                browShape: "worried sweep",
                noseShape: "long soft",
                noseBridge: "straight soft bridge",
                skinTone: "fair golden",
                outfit: "green station cloak",
                accessory: "folded wrong map",
                voice: "soft mezzo"
            }
        ],
        [
            "customer_orrin_hearth",
            "Orrin Hearth",
            [
                "food_service_restaurant",
                "general_trader"
            ],
            83,
            2,
            "neighborly",
            {
                hairStyle: "warm wool curls",
                hairColor: "brown gold",
                bodyBuild: "large gentle",
                heightBand: "large-mid",
                shoulderShape: "cushion broad",
                posture: "open chest",
                gait: "slow friendly",
                eyeColor: "walnut",
                eyeShape: "kind oval",
                browShape: "soft thick",
                noseShape: "large round",
                noseBridge: "broad kind bridge",
                skinTone: "dark warm umber",
                outfit: "brown supper coat",
                accessory: "wooden cup token",
                voice: "warm bass"
            }
        ],
        [
            "customer_pella_snow",
            "Pella Snow",
            [
                "medical_doctor",
                "hospitality_inn_hotel_shelter"
            ],
            89,
            4,
            "fragile",
            {
                hairStyle: "white pixie crop",
                hairColor: "snow white",
                bodyBuild: "small delicate",
                heightBand: "tiny",
                shoulderShape: "thin sloped",
                posture: "wrapped inward",
                gait: "careful glide",
                eyeColor: "pale blue",
                eyeShape: "watery oval",
                browShape: "white thread",
                noseShape: "small narrow",
                noseBridge: "fine pale bridge",
                skinTone: "light cool beige",
                outfit: "blue recovery shawl",
                accessory: "linen wrist wrap",
                voice: "breathy soprano"
            }
        ],
        [
            "customer_quorin_bale",
            "Quorin Bale",
            [
                "hunter_wild_meat",
                "security_defense_contractor"
            ],
            60,
            3,
            "watchful",
            {
                hairStyle: "thick side plait",
                hairColor: "oak brown",
                bodyBuild: "heavy hunter",
                heightBand: "tall-heavy",
                shoulderShape: "cloak broad",
                posture: "still ready",
                gait: "soft boot roll",
                eyeColor: "dark green",
                eyeShape: "deep watch",
                browShape: "heavy overhang",
                noseShape: "broad hook",
                noseBridge: "strong hooked bridge",
                skinTone: "medium red brown",
                outfit: "forest hide cloak",
                accessory: "trap ring",
                voice: "low rasp"
            }
        ],
        [
            "customer_rinna_bell",
            "Rinna Bell",
            [
                "biome_design_studio",
                "food_service_restaurant"
            ],
            91,
            3,
            "festival",
            {
                hairStyle: "ribbon spiral curls",
                hairColor: "golden pink",
                bodyBuild: "petite dancer",
                heightBand: "small-dancer",
                shoulderShape: "tiny square",
                posture: "arms lively",
                gait: "dance step",
                eyeColor: "bright amber",
                eyeShape: "spark almond",
                browShape: "arched lively",
                noseShape: "short pixie",
                noseBridge: "tiny lifted bridge",
                skinTone: "warm light brown",
                outfit: "red festival jacket",
                accessory: "little bell anklet",
                voice: "ringing alto"
            }
        ],
        [
            "customer_soren_drift",
            "Soren Drift",
            [
                "exploration_guide",
                "portal_transit_company"
            ],
            49,
            4,
            "distant",
            {
                hairStyle: "wind long fringe",
                hairColor: "pale brown",
                bodyBuild: "long weathered",
                heightBand: "very tall lean",
                shoulderShape: "narrow far",
                posture: "far gaze",
                gait: "trail stride",
                eyeColor: "fog blue",
                eyeShape: "far narrow",
                browShape: "wind worn",
                noseShape: "long weathered",
                noseBridge: "sun high bridge",
                skinTone: "weathered olive",
                outfit: "gray route cloak",
                accessory: "old route token",
                voice: "low tenor"
            }
        ],
        [
            "customer_talia_grease",
            "Talia Grease",
            [
                "repair_maintenance_person",
                "courier"
            ],
            70,
            2,
            "resourceful",
            {
                hairStyle: "oiled knot bun",
                hairColor: "black brown",
                bodyBuild: "compact mechanic",
                heightBand: "short-mechanic",
                shoulderShape: "strong narrow",
                posture: "knees bent",
                gait: "quick crouch walk",
                eyeColor: "dark amber",
                eyeShape: "sharp round",
                browShape: "grease smudge",
                noseShape: "smudged round",
                noseBridge: "short smudged bridge",
                skinTone: "medium brown",
                outfit: "blue repair coverall",
                accessory: "magnet glove",
                voice: "quick alto"
            }
        ],
        [
            "customer_ulric_pale",
            "Ulric Pale",
            [
                "magic_goods",
                "waste_sanitation_cleanup"
            ],
            44,
            4,
            "haunted",
            {
                hairStyle: "thin swept wisps",
                hairColor: "pale ash",
                bodyBuild: "hollow tall",
                heightBand: "hollow-mid",
                shoulderShape: "sunken thin",
                posture: "shivering straight",
                gait: "hesitant drift",
                eyeColor: "faded green",
                eyeShape: "hollow round",
                browShape: "faint worried",
                noseShape: "sharp hollow",
                noseBridge: "sunken bridge",
                skinTone: "pale gray tan",
                outfit: "patched ward blanket",
                accessory: "black salt pouch",
                voice: "thin bass"
            }
        ],
        [
            "customer_vanya_reef",
            "Vanya Reef",
            [
                "courier",
                "hunter_wild_meat"
            ],
            77,
            3,
            "sea-bright",
            {
                hairStyle: "wet rope braid",
                hairColor: "deep teal",
                bodyBuild: "swimmer strong",
                heightBand: "mid-swimmer",
                shoulderShape: "broad tapered",
                posture: "loose balanced",
                gait: "rolling dock step",
                eyeColor: "reef green",
                eyeShape: "smiling narrow",
                browShape: "wave curve",
                noseShape: "broad curved",
                noseBridge: "smooth wide bridge",
                skinTone: "deep olive brown",
                outfit: "teal dock vest",
                accessory: "shell knife charm",
                voice: "clear alto"
            }
        ],
        [
            "customer_willa_crane",
            "Willa Crane",
            [
                "custom_home_property_development",
                "biome_maintenance_repair"
            ],
            85,
            4,
            "landlord",
            {
                hairStyle: "gray high twist",
                hairColor: "charcoal white",
                bodyBuild: "thin tall elder",
                heightBand: "elder tall",
                shoulderShape: "bony square",
                posture: "ledger upright",
                gait: "cane precise",
                eyeColor: "sharp brown",
                eyeShape: "keen hooded",
                browShape: "white stern",
                noseShape: "long crane",
                noseBridge: "long arched bridge",
                skinTone: "cool medium brown",
                outfit: "black rent coat",
                accessory: "iron key belt",
                voice: "cutting contralto"
            }
        ],
        [
            "customer_ximo_lark",
            "Ximo Lark",
            [
                "general_trader",
                "exploration_guide"
            ],
            82,
            1,
            "chatty",
            {
                hairStyle: "fluffed lark crest",
                hairColor: "brown copper streak",
                bodyBuild: "tiny nimble",
                heightBand: "tiny-nimble",
                shoulderShape: "narrow quick",
                posture: "bouncing talk",
                gait: "darting skip",
                eyeColor: "bright black",
                eyeShape: "bead round",
                browShape: "tiny flick",
                noseShape: "little point",
                noseBridge: "tiny sharp bridge",
                skinTone: "gold tan",
                outfit: "patch pocket coat",
                accessory: "many little buttons",
                voice: "fast soprano"
            }
        ]
    ];
    var HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1 = CUSTOMER_ROWS.map(([npcId, displayName, businessPreferences, patience, budgetTier, temperament, appearance])=>({
            npcId,
            displayName,
            customerOnly: true,
            mapPlacement: "none",
            spawnPolicy: "business_owner_session_only",
            businessPreferences,
            patience,
            budgetTier,
            temperament,
            appearance
        }));
    function nav(typeId) {
        return {
            entryNodeId: `${typeId}:customer_entry`,
            queueNodeId: `${typeId}:customer_queue`,
            counterNodeId: `${typeId}:service_counter`,
            serviceNodeId: `${typeId}:service_spot`,
            exitNodeId: `${typeId}:customer_exit`,
            movementPolicy: "walk_queue_counter_exit",
            serviceFlow: [
                "enter",
                "join queue",
                "approach counter",
                "wait for service",
                "react",
                "exit"
            ],
            passableClearance: {
                aisleWidthBlocks: 2,
                counterClearanceBlocks: 2,
                queueSpacingBlocks: 1
            },
            stuckRecovery: {
                repathAfterMs: 2500,
                sidestepRadiusBlocks: 1.5,
                blockedNodeRetryLimit: 3,
                fallbackExitAfterMs: 15e3,
                fallbackPolicy: "repath_then_sidestep_then_exit"
            }
        };
    }
    function progression(scaleNoun) {
        return [
            {
                tier: 1,
                name: "Counter",
                criteria: "Serve 5 customers.",
                reward: "+1 queue slot.",
                unlock: `Basic ${scaleNoun} orders.`
            },
            {
                tier: 2,
                name: "Back Room",
                criteria: "Serve 20 customers with a 3-streak.",
                reward: "+5 satisfaction floor.",
                unlock: `Staff-assisted ${scaleNoun}.`
            },
            {
                tier: 3,
                name: "Branch",
                criteria: "Serve 50 customers and finish 10 contracts.",
                reward: "+1 service radius.",
                unlock: `Remote ${scaleNoun} tickets.`
            },
            {
                tier: 4,
                name: "Empire",
                criteria: "Serve 120 customers across locations.",
                reward: "+10 reputation cap pressure.",
                unlock: `Regional ${scaleNoun} franchise.`
            }
        ];
    }
    function definition(input) {
        return {
            ...input,
            navigation: nav(input.typeId),
            progression: progression(input.scaleNoun),
            implementationGapsClosed: [
                "Customers are session-only and do not pollute the permanent map.",
                "Every ask has an exact matching service offer.",
                "Customer path intent is stored as entrance, queue, counter, service, and exit steps.",
                "Growth pressure escalates through patience, queue size, required stock, and branch operations."
            ]
        };
    }
    var HARTHMERE_BUSINESS_MINIGAME_DEFINITIONS_V1 = {
        exotic_matter_refinery: definition({
            typeId: "exotic_matter_refinery",
            interfaceTitle: "Refinery Intake Counter",
            counterLabel: "Containment desk",
            customerGoal: "Customers want safe fuel, stabilized matter, or proof that a batch will not leak.",
            ownerFunLoop: "Scan the request, pick the safe service, spend the right stock, and keep the containment streak alive.",
            scaleNoun: "refinery",
            challengeGrowth: [
                "More hazardous customers arrive together.",
                "Fuel orders ask for certified stock.",
                "Low safety reduces patience.",
                "Later branches need couriers and sanitation partners."
            ],
            dailyReturnTriggers: [
                "Portal operators post fuel rushes.",
                "A cooled batch finishes overnight.",
                "Inspectors visit after risky shifts."
            ],
            scalePath: [
                "Manual stabilizer",
                "Certified fuel desk",
                "Courier-fed refinery",
                "Regional energy trust"
            ],
            empireReinforcement: [
                "Fuel contracts feed portal and teleport businesses.",
                "High safety reputation unlocks infrastructure customers.",
                "Branch refineries lower regional energy shortages."
            ],
            offers: [
                {
                    offerId: "certified_fuel_sale",
                    label: "Hand over certified fuel",
                    description: "Sell a sealed unit of fuel with a safety tag.",
                    serviceNeed: "energy",
                    requiredItems: {
                        certified_portal_fuel: 1
                    },
                    rewardGold: 150,
                    satisfactionDelta: 4,
                    interactionVerb: "stamp",
                    animationCue: "procedural_counter_stamp_and_hand_over"
                },
                {
                    offerId: "matter_stabilization",
                    label: "Stabilize a sample",
                    description: "Use stabilized matter to neutralize a customer's raw sample.",
                    serviceNeed: "timeline_stability",
                    requiredItems: {
                        stabilized_exotic_matter: 1,
                        containment_filter: 1
                    },
                    producedItems: {
                        spent_filter: 1
                    },
                    rewardGold: 125,
                    satisfactionDelta: 3,
                    interactionVerb: "seal",
                    animationCue: "procedural_filter_lock_and_glow_check"
                },
                {
                    offerId: "containment_audit",
                    label: "Run containment audit",
                    description: "Inspect a shipment and issue a safe handling report.",
                    serviceNeed: "travel",
                    requiredItems: {
                        containment_filter: 1
                    },
                    rewardGold: 95,
                    satisfactionDelta: 2,
                    interactionVerb: "scan",
                    animationCue: "procedural_scanner_sweep_counter"
                }
            ],
            askTemplates: [
                {
                    askId: "portal_fuel_needed",
                    line: "My gate crew needs one certified fuel cell before the route locks.",
                    desiredOfferId: "certified_fuel_sale",
                    patience: 48,
                    difficulty: 3,
                    rewardGold: 160,
                    reputationDelta: 2,
                    needDelta: 4,
                    funAction: "Match the fuel seal before patience drops.",
                    navGoal: "counterNodeId"
                },
                {
                    askId: "unstable_sample",
                    line: "This sample is humming through the case. Can you stabilize it now?",
                    desiredOfferId: "matter_stabilization",
                    patience: 38,
                    difficulty: 4,
                    rewardGold: 135,
                    reputationDelta: 2,
                    needDelta: 5,
                    funAction: "Choose stabilization instead of a simple audit.",
                    navGoal: "serviceNodeId"
                },
                {
                    askId: "safety_papers",
                    line: "I need proof this cargo can ride with passengers.",
                    desiredOfferId: "containment_audit",
                    patience: 60,
                    difficulty: 2,
                    rewardGold: 100,
                    reputationDelta: 1,
                    needDelta: 3,
                    funAction: "Scan, stamp, and send the customer out clean.",
                    navGoal: "counterNodeId"
                }
            ]
        }),
        biome_maintenance_repair: definition({
            typeId: "biome_maintenance_repair",
            interfaceTitle: "Biome Service Dispatch",
            counterLabel: "Anchor repair desk",
            customerGoal: "Customers bring failing climates, drifting anchors, and property stability complaints.",
            ownerFunLoop: "Diagnose the failure, choose inspection, tuning, or leak repair, and keep properties from decaying.",
            scaleNoun: "maintenance",
            challengeGrowth: [
                "More customers arrive with deadline pressure.",
                "Advanced asks need stabilized matter.",
                "Ignored failures lower town property condition.",
                "Branches specialize by climate type."
            ],
            dailyReturnTriggers: [
                "Weather failure alerts.",
                "Subscription inspections renew.",
                "A property owner reports overnight drift."
            ],
            scalePath: [
                "Inspection desk",
                "Repair van",
                "Climate tuning crew",
                "Regional maintenance network"
            ],
            empireReinforcement: [
                "Maintenance protects property developers and inns.",
                "Strong uptime feeds town trust.",
                "Branches create subscription income."
            ],
            offers: [
                {
                    offerId: "anchor_inspection",
                    label: "Inspect anchor",
                    description: "Run a quick stability inspection and issue next steps.",
                    serviceNeed: "maintenance",
                    requiredItems: {
                        repair_kit: 1
                    },
                    rewardGold: 80,
                    satisfactionDelta: 2,
                    interactionVerb: "inspect",
                    animationCue: "procedural_clipboard_scan_anchor"
                },
                {
                    offerId: "climate_tune",
                    label: "Tune climate",
                    description: "Stabilize weather and comfort levels using safe matter.",
                    serviceNeed: "property_condition",
                    requiredItems: {
                        stabilized_exotic_matter: 1,
                        repair_kit: 1
                    },
                    rewardGold: 125,
                    satisfactionDelta: 3,
                    interactionVerb: "tune",
                    animationCue: "procedural_dial_turn_weather_ring"
                },
                {
                    offerId: "timeline_leak_patch",
                    label: "Patch timeline leak",
                    description: "Seal a small leak before it becomes civic trouble.",
                    serviceNeed: "timeline_stability",
                    requiredItems: {
                        anchor_part: 1,
                        repair_kit: 1
                    },
                    rewardGold: 145,
                    satisfactionDelta: 4,
                    interactionVerb: "patch",
                    animationCue: "procedural_wrench_patch_spark"
                }
            ],
            askTemplates: [
                {
                    askId: "odd_weather_room",
                    line: "My reading room is raining indoors again.",
                    desiredOfferId: "climate_tune",
                    patience: 52,
                    difficulty: 3,
                    rewardGold: 130,
                    reputationDelta: 2,
                    needDelta: 4,
                    funAction: "Tune climate instead of only inspecting.",
                    navGoal: "serviceNodeId"
                },
                {
                    askId: "monthly_inspection",
                    line: "I need the anchor inspection stamped before rent day.",
                    desiredOfferId: "anchor_inspection",
                    patience: 70,
                    difficulty: 1,
                    rewardGold: 85,
                    reputationDelta: 1,
                    needDelta: 2,
                    funAction: "Fast paperwork service.",
                    navGoal: "counterNodeId"
                },
                {
                    askId: "leak_in_wall",
                    line: "The wall showed tomorrow for three seconds. Please patch it.",
                    desiredOfferId: "timeline_leak_patch",
                    patience: 42,
                    difficulty: 4,
                    rewardGold: 150,
                    reputationDelta: 2,
                    needDelta: 5,
                    funAction: "Spot the highest risk repair.",
                    navGoal: "serviceNodeId"
                }
            ]
        }),
        biome_design_studio: definition({
            typeId: "biome_design_studio",
            interfaceTitle: "Design Consultation Table",
            counterLabel: "Mood board counter",
            customerGoal: "Customers want beauty, identity, themed interiors, and event-ready spaces.",
            ownerFunLoop: "Read the taste cue, match a design package, and build reputation through pleasing choices.",
            scaleNoun: "design",
            challengeGrowth: [
                "Customers ask for conflicting styles.",
                "Luxury clients punish wrong packages.",
                "Seasonal trends rotate daily.",
                "Branches need stock from traders and farmers."
            ],
            dailyReturnTriggers: [
                "Festival color trend.",
                "VIP redesign slot.",
                "New decor materials arrive."
            ],
            scalePath: [
                "Mood board",
                "Installation crew",
                "Studio showroom",
                "Regional design house"
            ],
            empireReinforcement: [
                "Design raises property and hospitality value.",
                "High identity reputation draws luxury buyers.",
                "Branches create repeat seasonal work."
            ],
            offers: [
                {
                    offerId: "habitat_mockup",
                    label: "Show habitat mockup",
                    description: "Present a biome-safe room concept.",
                    serviceNeed: "identity",
                    requiredItems: {
                        design_pack: 1
                    },
                    rewardGold: 90,
                    satisfactionDelta: 3,
                    interactionVerb: "present",
                    animationCue: "procedural_blueprint_unroll_point"
                },
                {
                    offerId: "terrain_palette",
                    label: "Build terrain palette",
                    description: "Assemble color, stone, and plant samples.",
                    serviceNeed: "tourism",
                    requiredItems: {
                        decor: 1,
                        tree_resin: 1
                    },
                    rewardGold: 105,
                    satisfactionDelta: 3,
                    interactionVerb: "arrange",
                    animationCue: "procedural_sample_tiles_arrange"
                },
                {
                    offerId: "lighting_scene",
                    label: "Set lighting scene",
                    description: "Create a light plan for shop or inn ambience.",
                    serviceNeed: "housing",
                    requiredItems: {
                        lighting_kit: 1
                    },
                    rewardGold: 115,
                    satisfactionDelta: 4,
                    interactionVerb: "focus",
                    animationCue: "procedural_lantern_focus_sweep"
                }
            ],
            askTemplates: [
                {
                    askId: "make_inn_memorable",
                    line: "My inn needs a room guests remember tomorrow.",
                    desiredOfferId: "lighting_scene",
                    patience: 64,
                    difficulty: 2,
                    rewardGold: 120,
                    reputationDelta: 2,
                    needDelta: 4,
                    funAction: "Spot that ambience beats terrain.",
                    navGoal: "counterNodeId"
                },
                {
                    askId: "festival_palette",
                    line: "I need a festival palette that does not clash with the crops.",
                    desiredOfferId: "terrain_palette",
                    patience: 58,
                    difficulty: 3,
                    rewardGold: 110,
                    reputationDelta: 2,
                    needDelta: 3,
                    funAction: "Match color samples under pressure.",
                    navGoal: "serviceNodeId"
                },
                {
                    askId: "property_mockup",
                    line: "Can you show my family what the new biome room will feel like?",
                    desiredOfferId: "habitat_mockup",
                    patience: 72,
                    difficulty: 1,
                    rewardGold: 95,
                    reputationDelta: 1,
                    needDelta: 3,
                    funAction: "Present the simple pitch cleanly.",
                    navGoal: "counterNodeId"
                }
            ]
        }),
        security_defense_contractor: definition({
            typeId: "security_defense_contractor",
            interfaceTitle: "Security Contract Desk",
            counterLabel: "Threat board",
            customerGoal: "Customers need guards, escort plans, and fast risk calls.",
            ownerFunLoop: "Classify the threat, sell the right protection, and keep fear from becoming reputation damage.",
            scaleNoun: "security",
            challengeGrowth: [
                "Threat difficulty rises with reputation.",
                "Customers can arrive injured or panicked.",
                "Wrong service loses safety trust.",
                "Multiple branches need squads and gear stock."
            ],
            dailyReturnTriggers: [
                "New bounty wave.",
                "VIP escort deadline.",
                "Threat migration report."
            ],
            scalePath: [
                "Desk guard",
                "Patrol squad",
                "Escort office",
                "Regional defense company"
            ],
            empireReinforcement: [
                "Security protects couriers, portals, farms, and inns.",
                "High safety opens larger contracts.",
                "Branches reduce regional route risk."
            ],
            offers: [
                {
                    offerId: "hire_static_guard",
                    label: "Assign guard",
                    description: "Book a guard for a property or business floor.",
                    serviceNeed: "safety",
                    requiredItems: {
                        guard_contract: 1
                    },
                    rewardGold: 110,
                    satisfactionDelta: 3,
                    interactionVerb: "assign",
                    animationCue: "procedural_badge_assign_salute"
                },
                {
                    offerId: "escort_route_plan",
                    label: "Plan escort route",
                    description: "Build a safe path and emergency fallback.",
                    serviceNeed: "travel",
                    requiredItems: {
                        route_map: 1,
                        ration_pack: 1
                    },
                    rewardGold: 135,
                    satisfactionDelta: 3,
                    interactionVerb: "plot",
                    animationCue: "procedural_map_route_trace"
                },
                {
                    offerId: "threat_triage",
                    label: "Triage threat",
                    description: "Classify a threat and dispatch the right squad.",
                    serviceNeed: "tourism",
                    requiredItems: {
                        signal_flare: 1
                    },
                    rewardGold: 150,
                    satisfactionDelta: 4,
                    interactionVerb: "dispatch",
                    animationCue: "procedural_alarm_flag_dispatch"
                }
            ],
            askTemplates: [
                {
                    askId: "guard_my_shop",
                    line: "I need someone at my shop door before the night rush.",
                    desiredOfferId: "hire_static_guard",
                    patience: 62,
                    difficulty: 2,
                    rewardGold: 115,
                    reputationDelta: 2,
                    needDelta: 4,
                    funAction: "Assign guard coverage fast.",
                    navGoal: "counterNodeId"
                },
                {
                    askId: "escort_to_gate",
                    line: "Can your crew get my cargo through the north road?",
                    desiredOfferId: "escort_route_plan",
                    patience: 50,
                    difficulty: 3,
                    rewardGold: 140,
                    reputationDelta: 2,
                    needDelta: 4,
                    funAction: "Trace the safest route.",
                    navGoal: "serviceNodeId"
                },
                {
                    askId: "what_is_outside",
                    line: "Something is circling the yard. Tell me what to do.",
                    desiredOfferId: "threat_triage",
                    patience: 36,
                    difficulty: 4,
                    rewardGold: 160,
                    reputationDelta: 3,
                    needDelta: 5,
                    funAction: "Triage panic before patience breaks.",
                    navGoal: "serviceNodeId"
                }
            ]
        }),
        portal_transit_company: definition({
            typeId: "portal_transit_company",
            interfaceTitle: "Portal Transit Gate",
            counterLabel: "Route fare terminal",
            customerGoal: "Customers buy passenger jumps, cargo slots, and route safety checks.",
            ownerFunLoop: "Balance speed, fuel, safety, and queue pressure while keeping the route stable.",
            scaleNoun: "portal route",
            challengeGrowth: [
                "Passenger and cargo queues conflict.",
                "Fuel stock limits rush periods.",
                "Low stability slows service.",
                "Branches create route network dependencies."
            ],
            dailyReturnTriggers: [
                "Morning commuter rush.",
                "Cargo window expires.",
                "Fuel price spike."
            ],
            scalePath: [
                "Single gate",
                "Cargo lane",
                "Two-town route",
                "Regional portal grid"
            ],
            empireReinforcement: [
                "Portal routes multiply demand for fuel, security, and couriers.",
                "Reliable gates become civic infrastructure.",
                "Branches create empire-wide travel income."
            ],
            offers: [
                {
                    offerId: "passenger_jump",
                    label: "Run passenger jump",
                    description: "Move a passenger through a safe active endpoint.",
                    serviceNeed: "travel",
                    requiredItems: {
                        certified_portal_fuel: 1
                    },
                    rewardGold: 95,
                    satisfactionDelta: 3,
                    interactionVerb: "route",
                    animationCue: "procedural_gate_lever_customer_wave"
                },
                {
                    offerId: "cargo_slot",
                    label: "Book cargo slot",
                    description: "Reserve a heavier transit window for goods.",
                    serviceNeed: "logistics",
                    requiredItems: {
                        portal_fuel: 1,
                        lockbox: 1
                    },
                    rewardGold: 135,
                    satisfactionDelta: 3,
                    interactionVerb: "weigh",
                    animationCue: "procedural_scale_tag_cargo"
                },
                {
                    offerId: "route_safety_check",
                    label: "Run safety check",
                    description: "Check a route before a nervous customer travels.",
                    serviceNeed: "energy",
                    requiredItems: {
                        destination_crystal: 1
                    },
                    rewardGold: 110,
                    satisfactionDelta: 4,
                    interactionVerb: "calibrate",
                    animationCue: "procedural_crystal_align_gate"
                }
            ],
            askTemplates: [
                {
                    askId: "late_passenger",
                    line: "I need to cross before my pass expires.",
                    desiredOfferId: "passenger_jump",
                    patience: 34,
                    difficulty: 3,
                    rewardGold: 100,
                    reputationDelta: 2,
                    needDelta: 4,
                    funAction: "Prioritize passenger speed.",
                    navGoal: "serviceNodeId"
                },
                {
                    askId: "fragile_cargo",
                    line: "This crate cannot bounce through a cheap lane.",
                    desiredOfferId: "cargo_slot",
                    patience: 54,
                    difficulty: 3,
                    rewardGold: 145,
                    reputationDelta: 2,
                    needDelta: 4,
                    funAction: "Pick cargo handling, not passenger routing.",
                    navGoal: "counterNodeId"
                },
                {
                    askId: "nervous_about_gate",
                    line: "Does that gate look green enough to you?",
                    desiredOfferId: "route_safety_check",
                    patience: 66,
                    difficulty: 2,
                    rewardGold: 115,
                    reputationDelta: 1,
                    needDelta: 3,
                    funAction: "Calibrate to reassure.",
                    navGoal: "serviceNodeId"
                }
            ]
        }),
        biome_farming_rare_foods: definition({
            typeId: "biome_farming_rare_foods",
            interfaceTitle: "Rare Food Farm Stand",
            counterLabel: "Harvest scale",
            customerGoal: "Customers ask for fresh produce, medicinal herbs, or rare food lots.",
            ownerFunLoop: "Match freshness and ingredient type while protecting limited harvest stock.",
            scaleNoun: "farm",
            challengeGrowth: [
                "Freshness matters more at higher tiers.",
                "Doctors and restaurants compete for the same crop.",
                "Spoilage creates daily urgency.",
                "Branches specialize by biome climate."
            ],
            dailyReturnTriggers: [
                "Overnight crop growth.",
                "Market demand spike.",
                "Spoilage warning."
            ],
            scalePath: [
                "Farm stand",
                "Cold shelf",
                "Contract greenhouse",
                "Regional rare-food co-op"
            ],
            empireReinforcement: [
                "Farms feed restaurants, doctors, traders, and inns.",
                "Reliable harvests stabilize food demand.",
                "Branches buffer crop failures."
            ],
            offers: [
                {
                    offerId: "fresh_crop_bundle",
                    label: "Sell crop bundle",
                    description: "Hand over a fresh cooking crop bundle.",
                    serviceNeed: "food",
                    requiredItems: {
                        crop_bundle: 1
                    },
                    rewardGold: 45,
                    satisfactionDelta: 2,
                    interactionVerb: "weigh",
                    animationCue: "procedural_crate_weigh_and_wrap"
                },
                {
                    offerId: "medicinal_herbs",
                    label: "Pack medicinal herbs",
                    description: "Bundle herbs for clinics or potion makers.",
                    serviceNeed: "health",
                    requiredItems: {
                        herb_bundle: 1
                    },
                    rewardGold: 70,
                    satisfactionDelta: 3,
                    interactionVerb: "bundle",
                    animationCue: "procedural_herb_tie_and_label"
                },
                {
                    offerId: "rare_tasting_box",
                    label: "Prepare tasting box",
                    description: "Assemble rare foods for luxury or festival customers.",
                    serviceNeed: "tourism",
                    requiredItems: {
                        rare_food: 1,
                        clean_water: 1
                    },
                    rewardGold: 95,
                    satisfactionDelta: 4,
                    interactionVerb: "arrange",
                    animationCue: "procedural_sample_box_present"
                }
            ],
            askTemplates: [
                {
                    askId: "restaurant_crop_order",
                    line: "My cook needs crops that still smell like the field.",
                    desiredOfferId: "fresh_crop_bundle",
                    patience: 64,
                    difficulty: 1,
                    rewardGold: 50,
                    reputationDelta: 1,
                    needDelta: 3,
                    funAction: "Choose basic fresh food fast.",
                    navGoal: "counterNodeId"
                },
                {
                    askId: "clinic_herbs",
                    line: "The clinic is short on clean herbs.",
                    desiredOfferId: "medicinal_herbs",
                    patience: 48,
                    difficulty: 2,
                    rewardGold: 75,
                    reputationDelta: 2,
                    needDelta: 4,
                    funAction: "Save herbs for health demand.",
                    navGoal: "counterNodeId"
                },
                {
                    askId: "festival_tasting",
                    line: "I want the box people talk about after the festival.",
                    desiredOfferId: "rare_tasting_box",
                    patience: 70,
                    difficulty: 3,
                    rewardGold: 100,
                    reputationDelta: 2,
                    needDelta: 4,
                    funAction: "Use rare stock for reputation.",
                    navGoal: "serviceNodeId"
                }
            ]
        }),
        weapons_tools: definition({
            typeId: "weapons_tools",
            interfaceTitle: "Forge Service Counter",
            counterLabel: "Repair bench",
            customerGoal: "Customers need repairs, upgrades, and work tools that will not fail.",
            ownerFunLoop: "Read the equipment need, spend parts, and time the handoff for a satisfying repair.",
            scaleNoun: "forge",
            challengeGrowth: [
                "Higher-tier gear needs more parts.",
                "Security contracts create rush orders.",
                "Wrong service damages satisfaction.",
                "Branches specialize by tool or weapon line."
            ],
            dailyReturnTriggers: [
                "Broken gear pile.",
                "Guard bulk order.",
                "Ore delivery return."
            ],
            scalePath: [
                "Repair bench",
                "Upgrade forge",
                "Bulk order line",
                "Regional armory"
            ],
            empireReinforcement: [
                "Forges support hunters, guards, builders, and repair shops.",
                "Durable tools lower business failures.",
                "Branches become supply anchors."
            ],
            offers: [
                {
                    offerId: "tool_repair",
                    label: "Repair tool",
                    description: "Fix a work tool with parts and a calibrated strike.",
                    serviceNeed: "maintenance",
                    requiredItems: {
                        repair_tool: 1,
                        metal_part: 1
                    },
                    rewardGold: 75,
                    satisfactionDelta: 3,
                    interactionVerb: "hammer",
                    animationCue: "procedural_hammer_sparks_counter"
                },
                {
                    offerId: "weapon_tune",
                    label: "Tune weapon",
                    description: "Sharpen, balance, and safety-check a weapon.",
                    serviceNeed: "safety",
                    requiredItems: {
                        iron_ingot: 1,
                        whetstone: 1
                    },
                    rewardGold: 105,
                    satisfactionDelta: 3,
                    interactionVerb: "sharpen",
                    animationCue: "procedural_whetstone_blade_pass"
                },
                {
                    offerId: "scanner_calibration",
                    label: "Calibrate scanner",
                    description: "Tune a field scanner for builders or explorers.",
                    serviceNeed: "property_condition",
                    requiredItems: {
                        crystal_lens: 1,
                        repair_tool: 1
                    },
                    rewardGold: 120,
                    satisfactionDelta: 4,
                    interactionVerb: "calibrate",
                    animationCue: "procedural_lens_twist_flash"
                }
            ],
            askTemplates: [
                {
                    askId: "broken_pick",
                    line: "My pick is dead and the vein will not wait.",
                    desiredOfferId: "tool_repair",
                    patience: 50,
                    difficulty: 2,
                    rewardGold: 80,
                    reputationDelta: 1,
                    needDelta: 3,
                    funAction: "Repair the tool before the rush leaves.",
                    navGoal: "serviceNodeId"
                },
                {
                    askId: "guard_blade",
                    line: "This blade pulls left. I need it true.",
                    desiredOfferId: "weapon_tune",
                    patience: 58,
                    difficulty: 3,
                    rewardGold: 110,
                    reputationDelta: 2,
                    needDelta: 4,
                    funAction: "Pick weapon tuning over generic repair.",
                    navGoal: "serviceNodeId"
                },
                {
                    askId: "scanner_for_plot",
                    line: "My scanner says the wall is inside-out.",
                    desiredOfferId: "scanner_calibration",
                    patience: 66,
                    difficulty: 4,
                    rewardGold: 125,
                    reputationDelta: 2,
                    needDelta: 4,
                    funAction: "Use the precision calibration.",
                    navGoal: "counterNodeId"
                }
            ]
        }),
        magic_goods: definition({
            typeId: "magic_goods",
            interfaceTitle: "Magic Goods Counter",
            counterLabel: "Ward tray",
            customerGoal: "Customers buy charms, potions, and wards with stability risks.",
            ownerFunLoop: "Match the customer's fear to a charm, potion, or ward while unstable goods expire.",
            scaleNoun: "magic goods",
            challengeGrowth: [
                "Unstable stock expires faster.",
                "Customers ask for rare component matches.",
                "High-risk wards require license trust.",
                "Branches share component supply."
            ],
            dailyReturnTriggers: [
                "Unstable stock expires today.",
                "Disaster demand spike.",
                "Rare component visitor."
            ],
            scalePath: [
                "Charm tray",
                "Potion shelf",
                "Ward installation desk",
                "Regional arcane supplier"
            ],
            empireReinforcement: [
                "Magic goods support doctors, explorers, security, and refineries.",
                "High trust unlocks hazardous customers.",
                "Branches create rare component pull."
            ],
            offers: [
                {
                    offerId: "sell_charm",
                    label: "Sell charm",
                    description: "Match a small charm to a customer's worry.",
                    serviceNeed: "safety",
                    requiredItems: {
                        charm: 1
                    },
                    rewardGold: 80,
                    satisfactionDelta: 3,
                    interactionVerb: "attune",
                    animationCue: "procedural_charm_attune_handoff"
                },
                {
                    offerId: "mix_potion",
                    label: "Mix potion",
                    description: "Prepare a stable potion from shelf stock.",
                    serviceNeed: "health",
                    requiredItems: {
                        potion: 1,
                        clean_water: 1
                    },
                    rewardGold: 95,
                    satisfactionDelta: 3,
                    interactionVerb: "mix",
                    animationCue: "procedural_bottle_swirl_cork"
                },
                {
                    offerId: "write_ward",
                    label: "Write ward",
                    description: "Issue a protective ward for a room or route.",
                    serviceNeed: "timeline_stability",
                    requiredItems: {
                        ward: 1,
                        relic_fragment: 1
                    },
                    rewardGold: 145,
                    satisfactionDelta: 4,
                    interactionVerb: "scribe",
                    animationCue: "procedural_rune_scribe_glow"
                }
            ],
            askTemplates: [
                {
                    askId: "bad_luck_charm",
                    line: "I need something small that keeps trouble off my cart.",
                    desiredOfferId: "sell_charm",
                    patience: 70,
                    difficulty: 1,
                    rewardGold: 85,
                    reputationDelta: 1,
                    needDelta: 3,
                    funAction: "Pick charm for simple fear.",
                    navGoal: "counterNodeId"
                },
                {
                    askId: "quick_potion",
                    line: "Do you have a potion that will not curdle by sundown?",
                    desiredOfferId: "mix_potion",
                    patience: 52,
                    difficulty: 2,
                    rewardGold: 100,
                    reputationDelta: 2,
                    needDelta: 4,
                    funAction: "Serve stable potion stock.",
                    navGoal: "serviceNodeId"
                },
                {
                    askId: "room_ward",
                    line: "My rental room keeps whispering through the wall.",
                    desiredOfferId: "write_ward",
                    patience: 44,
                    difficulty: 4,
                    rewardGold: 155,
                    reputationDelta: 2,
                    needDelta: 5,
                    funAction: "Use a ward, not a charm.",
                    navGoal: "serviceNodeId"
                }
            ]
        }),
        exploration_guide: definition({
            typeId: "exploration_guide",
            interfaceTitle: "Guide Booking Table",
            counterLabel: "Route map table",
            customerGoal: "Customers need routes, expeditions, and risk advice.",
            ownerFunLoop: "Match destination, safety, and supply needs before the customer loses nerve.",
            scaleNoun: "guide route",
            challengeGrowth: [
                "Maps go stale.",
                "Clients demand rarer routes.",
                "Safety reputation affects patience.",
                "Branches need local route knowledge."
            ],
            dailyReturnTriggers: [
                "Map freshness decay.",
                "Rare ruin booking.",
                "Weather window opens."
            ],
            scalePath: [
                "Route advice",
                "Guided trip",
                "Expedition crew",
                "Regional guide guild"
            ],
            empireReinforcement: [
                "Guides create demand for couriers, guards, magic goods, and inns.",
                "Safe route reputation opens premium tours.",
                "Branches spread knowledge coverage."
            ],
            offers: [
                {
                    offerId: "route_briefing",
                    label: "Give route briefing",
                    description: "Explain a safe path and mark danger points.",
                    serviceNeed: "knowledge",
                    requiredItems: {
                        route_map: 1
                    },
                    rewardGold: 65,
                    satisfactionDelta: 2,
                    interactionVerb: "brief",
                    animationCue: "procedural_map_point_sequence"
                },
                {
                    offerId: "guided_expedition",
                    label: "Book expedition",
                    description: "Schedule a guided run with field supplies.",
                    serviceNeed: "travel",
                    requiredItems: {
                        field_kit: 1,
                        ration_pack: 1
                    },
                    rewardGold: 130,
                    satisfactionDelta: 4,
                    interactionVerb: "book",
                    animationCue: "procedural_ticket_stamp_map_fold"
                },
                {
                    offerId: "danger_read",
                    label: "Read danger signs",
                    description: "Assess a customer's destination risk.",
                    serviceNeed: "safety",
                    requiredItems: {
                        scanner: 1
                    },
                    rewardGold: 95,
                    satisfactionDelta: 3,
                    interactionVerb: "assess",
                    animationCue: "procedural_scope_scan_horizon"
                }
            ],
            askTemplates: [
                {
                    askId: "which_path",
                    line: "Which road gets me there with my boots still mine?",
                    desiredOfferId: "route_briefing",
                    patience: 78,
                    difficulty: 1,
                    rewardGold: 70,
                    reputationDelta: 1,
                    needDelta: 3,
                    funAction: "Give fast route advice.",
                    navGoal: "counterNodeId"
                },
                {
                    askId: "book_ruin_trip",
                    line: "I want to see the old marker, but I want to come back too.",
                    desiredOfferId: "guided_expedition",
                    patience: 55,
                    difficulty: 3,
                    rewardGold: 140,
                    reputationDelta: 2,
                    needDelta: 4,
                    funAction: "Convert interest into a booked trip.",
                    navGoal: "serviceNodeId"
                },
                {
                    askId: "is_it_safe",
                    line: "This destination keeps disappearing from my notes.",
                    desiredOfferId: "danger_read",
                    patience: 45,
                    difficulty: 4,
                    rewardGold: 105,
                    reputationDelta: 2,
                    needDelta: 4,
                    funAction: "Read danger signs before booking.",
                    navGoal: "counterNodeId"
                }
            ]
        }),
        custom_home_property_development: definition({
            typeId: "custom_home_property_development",
            interfaceTitle: "Property Development Office",
            counterLabel: "Blueprint desk",
            customerGoal: "Customers ask for builds, estimates, and staged improvements.",
            ownerFunLoop: "Pick estimate, permit, or build package while tracking material pressure.",
            scaleNoun: "property",
            challengeGrowth: [
                "Bigger builds consume more materials.",
                "Customers care about permits and deadlines.",
                "Bad estimates damage trust.",
                "Branches need managers and warehouses."
            ],
            dailyReturnTriggers: [
                "Build stage completes.",
                "Permit window opens.",
                "Tenant request arrives."
            ],
            scalePath: [
                "Estimate desk",
                "Build crew",
                "Subdivision office",
                "Regional property empire"
            ],
            empireReinforcement: [
                "Developers create locations for every other business.",
                "Good builds increase town housing.",
                "Branches turn land into empire expansion."
            ],
            offers: [
                {
                    offerId: "cost_estimate",
                    label: "Prepare estimate",
                    description: "Give a priced scope for a small property job.",
                    serviceNeed: "housing",
                    requiredItems: {
                        blueprint: 1
                    },
                    rewardGold: 75,
                    satisfactionDelta: 2,
                    interactionVerb: "estimate",
                    animationCue: "procedural_blueprint_measure_mark"
                },
                {
                    offerId: "permit_packet",
                    label: "File permit packet",
                    description: "Bundle permits and plans for a build.",
                    serviceNeed: "property_condition",
                    requiredItems: {
                        permit_form: 1,
                        blueprint: 1
                    },
                    rewardGold: 105,
                    satisfactionDelta: 3,
                    interactionVerb: "file",
                    animationCue: "procedural_paper_stack_stamp"
                },
                {
                    offerId: "starter_build_package",
                    label: "Sell build package",
                    description: "Commit materials for a starter property stage.",
                    serviceNeed: "maintenance",
                    requiredItems: {
                        wood_plank: 2,
                        stone_block: 2
                    },
                    rewardGold: 170,
                    satisfactionDelta: 4,
                    interactionVerb: "commit",
                    animationCue: "procedural_crate_tag_blueprint"
                }
            ],
            askTemplates: [
                {
                    askId: "what_will_it_cost",
                    line: "Tell me what a real door and roof will cost.",
                    desiredOfferId: "cost_estimate",
                    patience: 82,
                    difficulty: 1,
                    rewardGold: 80,
                    reputationDelta: 1,
                    needDelta: 3,
                    funAction: "Start with the estimate.",
                    navGoal: "counterNodeId"
                },
                {
                    askId: "permit_before_rain",
                    line: "I need the permit packet before the rain inspector comes.",
                    desiredOfferId: "permit_packet",
                    patience: 54,
                    difficulty: 2,
                    rewardGold: 110,
                    reputationDelta: 2,
                    needDelta: 4,
                    funAction: "File the correct paperwork.",
                    navGoal: "counterNodeId"
                },
                {
                    askId: "build_starter_shell",
                    line: "Can your crew start the shell this week?",
                    desiredOfferId: "starter_build_package",
                    patience: 48,
                    difficulty: 4,
                    rewardGold: 180,
                    reputationDelta: 3,
                    needDelta: 5,
                    funAction: "Spend materials for a real build package.",
                    navGoal: "serviceNodeId"
                }
            ]
        }),
        general_trader: definition({
            typeId: "general_trader",
            interfaceTitle: "General Trading Counter",
            counterLabel: "Stock ledger",
            customerGoal: "Customers want basic goods, brokerage, and regional price help.",
            ownerFunLoop: "Read demand, pick stock or brokerage, and keep shelves from going empty.",
            scaleNoun: "trade",
            challengeGrowth: [
                "More customers ask for scarce items.",
                "Market prices shift daily.",
                "Wrong upsells reduce trust.",
                "Branches create arbitrage routes."
            ],
            dailyReturnTriggers: [
                "Wholesale restock.",
                "Demand spike.",
                "Regional price spread."
            ],
            scalePath: [
                "Counter shop",
                "Backroom stock",
                "Warehouse link",
                "Regional trading house"
            ],
            empireReinforcement: [
                "Traders supply every small business.",
                "Market trust turns into bulk contracts.",
                "Branches move goods where demand is highest."
            ],
            offers: [
                {
                    offerId: "sell_road_rations",
                    label: "Sell road rations",
                    description: "Provide basic food for work or travel.",
                    serviceNeed: "food",
                    requiredItems: {
                        road_ration: 1
                    },
                    rewardGold: 35,
                    satisfactionDelta: 2,
                    interactionVerb: "bag",
                    animationCue: "procedural_shelf_pick_bag"
                },
                {
                    offerId: "sell_repair_supplies",
                    label: "Sell repair supplies",
                    description: "Bundle small parts for a customer job.",
                    serviceNeed: "maintenance",
                    requiredItems: {
                        repair_part: 1
                    },
                    rewardGold: 50,
                    satisfactionDelta: 2,
                    interactionVerb: "bundle",
                    animationCue: "procedural_parts_tray_wrap"
                },
                {
                    offerId: "broker_special_order",
                    label: "Broker special order",
                    description: "Take a paid request for hard-to-find goods.",
                    serviceNeed: "logistics",
                    requiredItems: {
                        trade_goods: 1,
                        ledger_page: 1
                    },
                    rewardGold: 95,
                    satisfactionDelta: 4,
                    interactionVerb: "broker",
                    animationCue: "procedural_ledger_note_handshake"
                }
            ],
            askTemplates: [
                {
                    askId: "need_rations",
                    line: "I need food that survives a rough road.",
                    desiredOfferId: "sell_road_rations",
                    patience: 76,
                    difficulty: 1,
                    rewardGold: 40,
                    reputationDelta: 1,
                    needDelta: 3,
                    funAction: "Grab the right shelf item.",
                    navGoal: "counterNodeId"
                },
                {
                    askId: "small_parts",
                    line: "Do you have the parts before my hinge gives up?",
                    desiredOfferId: "sell_repair_supplies",
                    patience: 62,
                    difficulty: 2,
                    rewardGold: 55,
                    reputationDelta: 1,
                    needDelta: 3,
                    funAction: "Bundle supplies quickly.",
                    navGoal: "counterNodeId"
                },
                {
                    askId: "rare_order",
                    line: "Can you find something the stalls do not carry?",
                    desiredOfferId: "broker_special_order",
                    patience: 58,
                    difficulty: 3,
                    rewardGold: 100,
                    reputationDelta: 2,
                    needDelta: 4,
                    funAction: "Choose brokerage for a special request.",
                    navGoal: "serviceNodeId"
                }
            ]
        }),
        hunter_wild_meat: definition({
            typeId: "hunter_wild_meat",
            interfaceTitle: "Hunter Larder Counter",
            counterLabel: "Cold larder",
            customerGoal: "Customers buy meat, hides, and wildlife-control advice.",
            ownerFunLoop: "Balance freshness, protected-species rules, and restaurant demand.",
            scaleNoun: "hunting",
            challengeGrowth: [
                "Fresh meat spoils.",
                "Protected jobs need permits.",
                "Restaurants ask for larger cuts.",
                "Branches need sustainable populations."
            ],
            dailyReturnTriggers: [
                "Wildlife migration.",
                "Meat spoilage warning.",
                "Restaurant rush."
            ],
            scalePath: [
                "Larder counter",
                "Cold storage",
                "Licensed hunting crew",
                "Regional provision network"
            ],
            empireReinforcement: [
                "Hunters feed restaurants and traders.",
                "Wildlife control improves safety.",
                "Branches secure local protein supply."
            ],
            offers: [
                {
                    offerId: "sell_wild_meat",
                    label: "Sell wild meat",
                    description: "Hand over fresh meat for cooking.",
                    serviceNeed: "food",
                    requiredItems: {
                        wild_meat: 1
                    },
                    rewardGold: 55,
                    satisfactionDelta: 2,
                    interactionVerb: "wrap",
                    animationCue: "procedural_cold_wrap_handoff"
                },
                {
                    offerId: "prepare_hide_bundle",
                    label: "Prepare hide bundle",
                    description: "Bundle hides for crafting or repairs.",
                    serviceNeed: "maintenance",
                    requiredItems: {
                        hide: 1
                    },
                    rewardGold: 65,
                    satisfactionDelta: 2,
                    interactionVerb: "bind",
                    animationCue: "procedural_hide_roll_bind"
                },
                {
                    offerId: "wildlife_control_advice",
                    label: "Give control advice",
                    description: "Advise a customer on a nuisance population.",
                    serviceNeed: "safety",
                    requiredItems: {
                        route_map: 1
                    },
                    rewardGold: 85,
                    satisfactionDelta: 3,
                    interactionVerb: "advise",
                    animationCue: "procedural_track_mark_map"
                }
            ],
            askTemplates: [
                {
                    askId: "fresh_meat",
                    line: "The stew wants something wild and fresh.",
                    desiredOfferId: "sell_wild_meat",
                    patience: 60,
                    difficulty: 1,
                    rewardGold: 60,
                    reputationDelta: 1,
                    needDelta: 3,
                    funAction: "Serve fresh meat before it spoils.",
                    navGoal: "counterNodeId"
                },
                {
                    askId: "need_hides",
                    line: "My repair job needs tough hide, not cloth.",
                    desiredOfferId: "prepare_hide_bundle",
                    patience: 68,
                    difficulty: 2,
                    rewardGold: 70,
                    reputationDelta: 1,
                    needDelta: 3,
                    funAction: "Pick hide supply over food.",
                    navGoal: "counterNodeId"
                },
                {
                    askId: "yard_tracks",
                    line: "Something keeps rooting up my yard. What is it?",
                    desiredOfferId: "wildlife_control_advice",
                    patience: 48,
                    difficulty: 3,
                    rewardGold: 90,
                    reputationDelta: 2,
                    needDelta: 4,
                    funAction: "Use tracking knowledge.",
                    navGoal: "serviceNodeId"
                }
            ]
        }),
        medical_doctor: definition({
            typeId: "medical_doctor",
            interfaceTitle: "Clinic Triage Desk",
            counterLabel: "Treatment cot",
            customerGoal: "Customers need triage, medicine, and treatment with trust consequences.",
            ownerFunLoop: "Read symptoms, choose care level, spend medicine, and protect the clinic's trust streak.",
            scaleNoun: "clinic",
            challengeGrowth: [
                "Higher severity lowers patience.",
                "Outbreak days create waves.",
                "Wrong care costs reputation.",
                "Branches need supply couriers and specialists."
            ],
            dailyReturnTriggers: [
                "Morning triage queue.",
                "Medicine stock alert.",
                "Outbreak-risk visitor."
            ],
            scalePath: [
                "Triage cot",
                "Treatment room",
                "Specialist clinic",
                "Regional health network"
            ],
            empireReinforcement: [
                "Clinics create demand for herbs, couriers, sanitation, and magic goods.",
                "High trust unlocks severe cases.",
                "Branches improve town health coverage."
            ],
            offers: [
                {
                    offerId: "basic_checkup",
                    label: "Run checkup",
                    description: "Diagnose a low-risk complaint.",
                    serviceNeed: "health",
                    requiredItems: {
                        bandage: 1
                    },
                    rewardGold: 60,
                    satisfactionDelta: 2,
                    interactionVerb: "examine",
                    animationCue: "procedural_pulse_check_clipboard"
                },
                {
                    offerId: "field_medkit_sale",
                    label: "Issue medkit",
                    description: "Prepare and sell field medical supplies.",
                    serviceNeed: "health",
                    requiredItems: {
                        field_medkit: 1
                    },
                    rewardGold: 85,
                    satisfactionDelta: 3,
                    interactionVerb: "issue",
                    animationCue: "procedural_medkit_open_close"
                },
                {
                    offerId: "urgent_treatment",
                    label: "Treat urgent case",
                    description: "Use medicine and supplies on a serious patient.",
                    serviceNeed: "sanitation",
                    requiredItems: {
                        medicine: 1,
                        field_medkit: 1
                    },
                    rewardGold: 135,
                    satisfactionDelta: 4,
                    interactionVerb: "treat",
                    animationCue: "procedural_treatment_cot_work"
                }
            ],
            askTemplates: [
                {
                    askId: "small_cut",
                    line: "It is probably nothing, but it keeps glowing.",
                    desiredOfferId: "basic_checkup",
                    patience: 72,
                    difficulty: 1,
                    rewardGold: 65,
                    reputationDelta: 1,
                    needDelta: 3,
                    funAction: "Triage low severity quickly.",
                    navGoal: "serviceNodeId"
                },
                {
                    askId: "field_kit",
                    line: "I need a kit before I go back outside.",
                    desiredOfferId: "field_medkit_sale",
                    patience: 58,
                    difficulty: 2,
                    rewardGold: 90,
                    reputationDelta: 1,
                    needDelta: 3,
                    funAction: "Issue supplies, do not over-treat.",
                    navGoal: "counterNodeId"
                },
                {
                    askId: "urgent_symptom",
                    line: "My arm forgot which year it belongs to.",
                    desiredOfferId: "urgent_treatment",
                    patience: 34,
                    difficulty: 4,
                    rewardGold: 145,
                    reputationDelta: 3,
                    needDelta: 5,
                    funAction: "Treat the high-risk case first.",
                    navGoal: "serviceNodeId"
                }
            ]
        }),
        teleport_owner: definition({
            typeId: "teleport_owner",
            interfaceTitle: "Teleport Access Desk",
            counterLabel: "Pad terminal",
            customerGoal: "Customers need access keys, emergency returns, and pad stability checks.",
            ownerFunLoop: "Match destination, fuel, and access rights while preventing unstable jumps.",
            scaleNoun: "teleport pad",
            challengeGrowth: [
                "Access keys expire.",
                "Fuel limits rush traffic.",
                "Destination mistakes hurt trust.",
                "Branches form private fast-travel networks."
            ],
            dailyReturnTriggers: [
                "Access renewal queue.",
                "Emergency return request.",
                "Pad stability decay."
            ],
            scalePath: [
                "Private pad",
                "Public key desk",
                "Emergency return service",
                "Regional teleport network"
            ],
            empireReinforcement: [
                "Teleport pads feed courier, medical, and travel demand.",
                "Reliable pads attract premium customers.",
                "Branches make empire logistics fast."
            ],
            offers: [
                {
                    offerId: "issue_access_token",
                    label: "Issue access token",
                    description: "Grant a customer temporary pad access.",
                    serviceNeed: "travel",
                    requiredItems: {
                        teleport_token: 1
                    },
                    rewardGold: 85,
                    satisfactionDelta: 3,
                    interactionVerb: "key",
                    animationCue: "procedural_token_press_palm"
                },
                {
                    offerId: "emergency_return",
                    label: "Prepare emergency return",
                    description: "Sell a safer return jump with extra fuel checks.",
                    serviceNeed: "health",
                    requiredItems: {
                        emergency_return: 1,
                        teleport_fuel: 1
                    },
                    rewardGold: 130,
                    satisfactionDelta: 4,
                    interactionVerb: "anchor",
                    animationCue: "procedural_return_anchor_calibrate"
                },
                {
                    offerId: "pad_stability_check",
                    label: "Check pad stability",
                    description: "Calibrate destination and stability before travel.",
                    serviceNeed: "logistics",
                    requiredItems: {
                        destination_crystal: 1
                    },
                    rewardGold: 100,
                    satisfactionDelta: 3,
                    interactionVerb: "stabilize",
                    animationCue: "procedural_pad_ring_spin_check"
                }
            ],
            askTemplates: [
                {
                    askId: "need_key",
                    line: "Can I get a key that works until tomorrow?",
                    desiredOfferId: "issue_access_token",
                    patience: 64,
                    difficulty: 1,
                    rewardGold: 90,
                    reputationDelta: 1,
                    needDelta: 3,
                    funAction: "Issue access quickly.",
                    navGoal: "counterNodeId"
                },
                {
                    askId: "panic_return",
                    line: "If the road goes bad, I need to come home instantly.",
                    desiredOfferId: "emergency_return",
                    patience: 42,
                    difficulty: 3,
                    rewardGold: 140,
                    reputationDelta: 2,
                    needDelta: 4,
                    funAction: "Prepare emergency return, not a basic key.",
                    navGoal: "serviceNodeId"
                },
                {
                    askId: "pad_feels_wrong",
                    line: "The pad is humming on the wrong side of my teeth.",
                    desiredOfferId: "pad_stability_check",
                    patience: 52,
                    difficulty: 3,
                    rewardGold: 105,
                    reputationDelta: 2,
                    needDelta: 4,
                    funAction: "Calibrate before travel.",
                    navGoal: "serviceNodeId"
                }
            ]
        }),
        waste_sanitation_cleanup: definition({
            typeId: "waste_sanitation_cleanup",
            interfaceTitle: "Sanitation Dispatch Counter",
            counterLabel: "Cleanup board",
            customerGoal: "Customers request pickup, decontamination, and clean certificates.",
            ownerFunLoop: "Classify waste, spend cleaning stock, and prevent health penalties.",
            scaleNoun: "cleanup",
            challengeGrowth: [
                "Contamination severity rises.",
                "Restaurants and clinics demand fast pickup.",
                "Wrong handling hurts sanitation.",
                "Branches need routes and processing."
            ],
            dailyReturnTriggers: [
                "Waste accumulation tick.",
                "Inspection deadline.",
                "Outbreak warning."
            ],
            scalePath: [
                "Pickup counter",
                "Hazard crew",
                "Processing yard",
                "Regional sanitation authority"
            ],
            empireReinforcement: [
                "Sanitation keeps restaurants, clinics, refineries, and inns open.",
                "Clean records increase town trust.",
                "Branches prevent regional outbreaks."
            ],
            offers: [
                {
                    offerId: "trash_pickup",
                    label: "Schedule pickup",
                    description: "Take a standard trash pickup order.",
                    serviceNeed: "sanitation",
                    requiredItems: {
                        containment_barrel: 1
                    },
                    rewardGold: 55,
                    satisfactionDelta: 2,
                    interactionVerb: "schedule",
                    animationCue: "procedural_cleanup_ticket_clip"
                },
                {
                    offerId: "decontam_kit",
                    label: "Apply decontam kit",
                    description: "Neutralize a small contamination sample.",
                    serviceNeed: "health",
                    requiredItems: {
                        cleaning_reagent: 1,
                        containment_barrel: 1
                    },
                    rewardGold: 95,
                    satisfactionDelta: 3,
                    interactionVerb: "neutralize",
                    animationCue: "procedural_spray_seal_barrel"
                },
                {
                    offerId: "clean_certificate",
                    label: "Issue clean certificate",
                    description: "Verify a business is safe for inspection.",
                    serviceNeed: "timeline_stability",
                    requiredItems: {
                        clean_certificate: 1
                    },
                    rewardGold: 110,
                    satisfactionDelta: 4,
                    interactionVerb: "certify",
                    animationCue: "procedural_stamp_clean_certificate"
                }
            ],
            askTemplates: [
                {
                    askId: "barrel_pickup",
                    line: "I need this barrel gone before customers smell it.",
                    desiredOfferId: "trash_pickup",
                    patience: 58,
                    difficulty: 1,
                    rewardGold: 60,
                    reputationDelta: 1,
                    needDelta: 3,
                    funAction: "Schedule the simple pickup.",
                    navGoal: "counterNodeId"
                },
                {
                    askId: "sample_hisses",
                    line: "The sample hisses when I apologize to it.",
                    desiredOfferId: "decontam_kit",
                    patience: 40,
                    difficulty: 4,
                    rewardGold: 100,
                    reputationDelta: 2,
                    needDelta: 5,
                    funAction: "Use decontam for hazardous waste.",
                    navGoal: "serviceNodeId"
                },
                {
                    askId: "inspection_today",
                    line: "The inspector comes today. I need clean papers.",
                    desiredOfferId: "clean_certificate",
                    patience: 50,
                    difficulty: 3,
                    rewardGold: 115,
                    reputationDelta: 2,
                    needDelta: 4,
                    funAction: "Certify after checking stock.",
                    navGoal: "counterNodeId"
                }
            ]
        }),
        repair_maintenance_person: definition({
            typeId: "repair_maintenance_person",
            interfaceTitle: "Handyman Service Counter",
            counterLabel: "Fix-it bench",
            customerGoal: "Customers bring broken fixtures, furniture, and tiny emergencies.",
            ownerFunLoop: "Identify the object, choose parts, and finish fast enough to earn trust.",
            scaleNoun: "repair",
            challengeGrowth: [
                "More objects arrive at once.",
                "Urgent repairs have lower patience.",
                "Higher tiers need specialty parts.",
                "Branches need scheduled crews."
            ],
            dailyReturnTriggers: [
                "Object decay reports.",
                "Inn repair board.",
                "Rush repair visitor."
            ],
            scalePath: [
                "Tool belt",
                "Repair bench",
                "Facilities crew",
                "Regional maintenance brand"
            ],
            empireReinforcement: [
                "Repair keeps every business functional.",
                "Fast fixes improve property condition.",
                "Branches create subscription contracts."
            ],
            offers: [
                {
                    offerId: "fixture_fix",
                    label: "Fix fixture",
                    description: "Repair a door, hinge, shelf, or small machine.",
                    serviceNeed: "maintenance",
                    requiredItems: {
                        nails: 1,
                        repair_tool: 1
                    },
                    rewardGold: 50,
                    satisfactionDelta: 2,
                    interactionVerb: "tighten",
                    animationCue: "procedural_wrench_tighten_fixture"
                },
                {
                    offerId: "furniture_patch",
                    label: "Patch furniture",
                    description: "Use wood and fasteners on a worn object.",
                    serviceNeed: "housing",
                    requiredItems: {
                        wood_plank: 1,
                        nails: 1
                    },
                    rewardGold: 65,
                    satisfactionDelta: 3,
                    interactionVerb: "patch",
                    animationCue: "procedural_hammer_patch_board"
                },
                {
                    offerId: "urgent_service_call",
                    label: "Book urgent call",
                    description: "Dispatch the owner or worker to an emergency fix.",
                    serviceNeed: "property_condition",
                    requiredItems: {
                        repair_part: 1,
                        metal_part: 1
                    },
                    rewardGold: 95,
                    satisfactionDelta: 4,
                    interactionVerb: "dispatch",
                    animationCue: "procedural_toolbag_snap_dispatch"
                }
            ],
            askTemplates: [
                {
                    askId: "door_screams",
                    line: "My door screams louder than my guests.",
                    desiredOfferId: "fixture_fix",
                    patience: 68,
                    difficulty: 1,
                    rewardGold: 55,
                    reputationDelta: 1,
                    needDelta: 3,
                    funAction: "Fix the simple fixture.",
                    navGoal: "serviceNodeId"
                },
                {
                    askId: "chair_split",
                    line: "This chair split right before dinner.",
                    desiredOfferId: "furniture_patch",
                    patience: 52,
                    difficulty: 2,
                    rewardGold: 70,
                    reputationDelta: 1,
                    needDelta: 3,
                    funAction: "Patch furniture with wood.",
                    navGoal: "serviceNodeId"
                },
                {
                    askId: "pipe_burst",
                    line: "Water is coming through the ceiling right now.",
                    desiredOfferId: "urgent_service_call",
                    patience: 30,
                    difficulty: 4,
                    rewardGold: 100,
                    reputationDelta: 2,
                    needDelta: 5,
                    funAction: "Dispatch urgent service under pressure.",
                    navGoal: "counterNodeId"
                }
            ]
        }),
        food_service_restaurant: definition({
            typeId: "food_service_restaurant",
            interfaceTitle: "Restaurant Service Line",
            counterLabel: "Pass window",
            customerGoal: "Customers want meals, rations, and healing food with freshness expectations.",
            ownerFunLoop: "Read the appetite, pick the dish, spend stock, and keep the rush streak going.",
            scaleNoun: "restaurant",
            challengeGrowth: [
                "Meal rushes increase queue size.",
                "Ingredient shortages force tradeoffs.",
                "Sanitation affects patience.",
                "Branches need supply contracts."
            ],
            dailyReturnTriggers: [
                "Lunch rush.",
                "Fresh ingredient delivery.",
                "Festival catering spike."
            ],
            scalePath: [
                "Food cart",
                "Dining counter",
                "Catering kitchen",
                "Regional restaurant group"
            ],
            empireReinforcement: [
                "Restaurants consume farm, hunter, trader, and sanitation services.",
                "Food buffs drive daily returns.",
                "Branches stabilize town food happiness."
            ],
            offers: [
                {
                    offerId: "serve_worker_meal",
                    label: "Serve worker meal",
                    description: "Plate a reliable hot meal.",
                    serviceNeed: "food",
                    requiredItems: {
                        worker_meal: 1
                    },
                    rewardGold: 35,
                    satisfactionDelta: 2,
                    interactionVerb: "plate",
                    animationCue: "procedural_plate_slide_counter"
                },
                {
                    offerId: "pack_road_ration",
                    label: "Pack road ration",
                    description: "Wrap travel food for a customer on the move.",
                    serviceNeed: "tourism",
                    requiredItems: {
                        road_ration: 1
                    },
                    rewardGold: 45,
                    satisfactionDelta: 2,
                    interactionVerb: "wrap",
                    animationCue: "procedural_ration_wrap_tie"
                },
                {
                    offerId: "serve_healing_soup",
                    label: "Serve healing soup",
                    description: "Serve a restorative dish using rarer stock.",
                    serviceNeed: "health",
                    requiredItems: {
                        healing_soup: 1
                    },
                    rewardGold: 75,
                    satisfactionDelta: 4,
                    interactionVerb: "ladle",
                    animationCue: "procedural_soup_ladle_steam"
                }
            ],
            askTemplates: [
                {
                    askId: "hot_meal",
                    line: "I need something hot before my shift starts.",
                    desiredOfferId: "serve_worker_meal",
                    patience: 46,
                    difficulty: 1,
                    rewardGold: 40,
                    reputationDelta: 1,
                    needDelta: 3,
                    funAction: "Plate fast and keep the rush moving.",
                    navGoal: "counterNodeId"
                },
                {
                    askId: "travel_food",
                    line: "Pack me food that survives the road.",
                    desiredOfferId: "pack_road_ration",
                    patience: 56,
                    difficulty: 2,
                    rewardGold: 50,
                    reputationDelta: 1,
                    needDelta: 3,
                    funAction: "Choose ration over fresh meal.",
                    navGoal: "counterNodeId"
                },
                {
                    askId: "feel_awful",
                    line: "Do you have the soup that makes bones stop arguing?",
                    desiredOfferId: "serve_healing_soup",
                    patience: 42,
                    difficulty: 3,
                    rewardGold: 80,
                    reputationDelta: 2,
                    needDelta: 4,
                    funAction: "Use premium healing stock.",
                    navGoal: "serviceNodeId"
                }
            ]
        }),
        courier: definition({
            typeId: "courier",
            interfaceTitle: "Courier Dispatch Desk",
            counterLabel: "Parcel scale",
            customerGoal: "Customers need packages, medicine, and locked items delivered on time.",
            ownerFunLoop: "Read deadline and fragility, choose the right delivery product, and protect trust.",
            scaleNoun: "courier route",
            challengeGrowth: [
                "Deadlines shrink.",
                "Fragile cargo punishes errors.",
                "More locations mean route batching.",
                "Branches need dispatch managers."
            ],
            dailyReturnTriggers: [
                "Morning delivery board.",
                "Timed medicine run.",
                "Courier returns with proof slips."
            ],
            scalePath: [
                "Runner satchel",
                "Dispatch desk",
                "Route office",
                "Regional courier empire"
            ],
            empireReinforcement: [
                "Couriers connect every business supply chain.",
                "Reliable delivery raises cross-business throughput.",
                "Branches let the empire operate across towns."
            ],
            offers: [
                {
                    offerId: "standard_parcel",
                    label: "Accept parcel",
                    description: "Take a standard package with a proof slip.",
                    serviceNeed: "logistics",
                    requiredItems: {
                        parcel: 1
                    },
                    rewardGold: 45,
                    satisfactionDelta: 2,
                    interactionVerb: "weigh",
                    animationCue: "procedural_parcel_weigh_tag"
                },
                {
                    offerId: "locked_delivery",
                    label: "Accept locked delivery",
                    description: "Seal a valuable lockbox delivery.",
                    serviceNeed: "travel",
                    requiredItems: {
                        lockbox: 1
                    },
                    rewardGold: 75,
                    satisfactionDelta: 3,
                    interactionVerb: "seal",
                    animationCue: "procedural_lockbox_seal_check"
                },
                {
                    offerId: "medicine_run",
                    label: "Book medicine run",
                    description: "Prioritize a medical or food delivery.",
                    serviceNeed: "health",
                    requiredItems: {
                        sealed_package: 1,
                        route_map: 1
                    },
                    rewardGold: 95,
                    satisfactionDelta: 4,
                    interactionVerb: "dispatch",
                    animationCue: "procedural_route_stamp_runner_wave"
                }
            ],
            askTemplates: [
                {
                    askId: "simple_package",
                    line: "Can you get this parcel across town by evening?",
                    desiredOfferId: "standard_parcel",
                    patience: 66,
                    difficulty: 1,
                    rewardGold: 50,
                    reputationDelta: 1,
                    needDelta: 3,
                    funAction: "Weigh and tag the parcel.",
                    navGoal: "counterNodeId"
                },
                {
                    askId: "valuable_lockbox",
                    line: "This box needs a route that keeps hands off it.",
                    desiredOfferId: "locked_delivery",
                    patience: 54,
                    difficulty: 3,
                    rewardGold: 80,
                    reputationDelta: 2,
                    needDelta: 4,
                    funAction: "Choose locked service.",
                    navGoal: "counterNodeId"
                },
                {
                    askId: "medicine_deadline",
                    line: "The clinic needs this before the fever climbs.",
                    desiredOfferId: "medicine_run",
                    patience: 32,
                    difficulty: 4,
                    rewardGold: 100,
                    reputationDelta: 3,
                    needDelta: 5,
                    funAction: "Prioritize medicine under a short timer.",
                    navGoal: "serviceNodeId"
                }
            ]
        }),
        hospitality_inn_hotel_shelter: definition({
            typeId: "hospitality_inn_hotel_shelter",
            interfaceTitle: "Inn Front Desk",
            counterLabel: "Room ledger",
            customerGoal: "Customers want rooms, shelter beds, safe stays, and simple food.",
            ownerFunLoop: "Match room type, food, and safety need while keeping occupancy and cleanliness healthy.",
            scaleNoun: "lodging",
            challengeGrowth: [
                "Occupancy increases cleaning pressure.",
                "VIP guests demand better rooms.",
                "Shelter waves trade profit for civic trust.",
                "Branches need staff and food supply."
            ],
            dailyReturnTriggers: [
                "Guest checkout report.",
                "Room cleaning alert.",
                "Rare VIP traveler."
            ],
            scalePath: [
                "Common room",
                "Room ledger",
                "Full inn",
                "Regional hospitality chain"
            ],
            empireReinforcement: [
                "Inns consume food, sanitation, repair, and security services.",
                "Good stays improve tourism.",
                "Branches become player travel hubs."
            ],
            offers: [
                {
                    offerId: "book_basic_room",
                    label: "Book basic room",
                    description: "Assign a clean room for one stay.",
                    serviceNeed: "housing",
                    requiredItems: {
                        linen: 1
                    },
                    rewardGold: 65,
                    satisfactionDelta: 3,
                    interactionVerb: "key",
                    animationCue: "procedural_room_key_handoff"
                },
                {
                    offerId: "offer_shelter_bed",
                    label: "Offer shelter bed",
                    description: "Provide a safe emergency bed.",
                    serviceNeed: "safety",
                    requiredItems: {
                        clean_water: 1
                    },
                    rewardGold: 45,
                    satisfactionDelta: 4,
                    interactionVerb: "guide",
                    animationCue: "procedural_point_to_bed_ledger"
                },
                {
                    offerId: "guest_meal_bundle",
                    label: "Bundle room meal",
                    description: "Pair lodging with a meal for tired travelers.",
                    serviceNeed: "food",
                    requiredItems: {
                        linen: 1,
                        worker_meal: 1
                    },
                    rewardGold: 95,
                    satisfactionDelta: 4,
                    interactionVerb: "host",
                    animationCue: "procedural_key_and_plate_combo"
                }
            ],
            askTemplates: [
                {
                    askId: "need_room",
                    line: "One clean room and no surprises, please.",
                    desiredOfferId: "book_basic_room",
                    patience: 72,
                    difficulty: 1,
                    rewardGold: 70,
                    reputationDelta: 1,
                    needDelta: 3,
                    funAction: "Assign a room from the ledger.",
                    navGoal: "counterNodeId"
                },
                {
                    askId: "need_safe_bed",
                    line: "I just need somewhere safe until morning.",
                    desiredOfferId: "offer_shelter_bed",
                    patience: 50,
                    difficulty: 2,
                    rewardGold: 50,
                    reputationDelta: 2,
                    needDelta: 4,
                    funAction: "Choose shelter over room profit.",
                    navGoal: "serviceNodeId"
                },
                {
                    askId: "room_and_meal",
                    line: "If I sleep before eating, I may become furniture.",
                    desiredOfferId: "guest_meal_bundle",
                    patience: 44,
                    difficulty: 3,
                    rewardGold: 100,
                    reputationDelta: 2,
                    needDelta: 5,
                    funAction: "Bundle lodging and food.",
                    navGoal: "counterNodeId"
                }
            ]
        })
    };
    var HARTHMERE_BUSINESS_SERVICE_ITEM_IDS_V1 = [
        "anchor_part",
        "bandage",
        "blueprint",
        "certified_portal_fuel",
        "charm",
        "clean_certificate",
        "clean_water",
        "cleaning_reagent",
        "containment_barrel",
        "containment_filter",
        "crop_bundle",
        "crystal_lens",
        "decor",
        "design_pack",
        "destination_crystal",
        "emergency_return",
        "field_kit",
        "field_medkit",
        "guard_contract",
        "healing_soup",
        "herb_bundle",
        "hide",
        "iron_ingot",
        "ledger_page",
        "lighting_kit",
        "linen",
        "lockbox",
        "medicine",
        "metal_part",
        "nails",
        "parcel",
        "permit_form",
        "portal_fuel",
        "potion",
        "rare_food",
        "ration_pack",
        "relic_fragment",
        "repair_kit",
        "repair_part",
        "repair_tool",
        "road_ration",
        "route_map",
        "scanner",
        "sealed_package",
        "signal_flare",
        "spent_filter",
        "stabilized_exotic_matter",
        "stone_block",
        "teleport_fuel",
        "teleport_token",
        "trade_goods",
        "tree_resin",
        "ward",
        "whetstone",
        "wild_meat",
        "wood_plank",
        "worker_meal"
    ];
    function serviceItemDisplayNameV1(itemId) {
        return itemId.split("_").map((part)=>part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
    }
    function serviceItemRoleV1(itemId) {
        if (/certificate|form|ledger|blueprint|map|token|contract/.test(itemId)) return "paperwork";
        if (/barrel|lockbox|package|parcel|kit|box/.test(itemId)) return "container";
        if (/tool|scanner|whetstone|lens|nails|part/.test(itemId)) return "tool";
        if (/meal|ration|soup|water|medicine|bandage|potion|food|meat|crop|herb/.test(itemId)) return "consumable";
        if (/spent|waste/.test(itemId)) return "waste";
        if (/fuel|charm|ward|decor|design|package|goods|flare|linen|hide/.test(itemId)) return "finished_good";
        return "component";
    }
    var HARTHMERE_BUSINESS_SERVICE_ITEM_CATALOG_V1 = Object.freeze(Object.fromEntries(HARTHMERE_BUSINESS_SERVICE_ITEM_IDS_V1.map((itemId)=>[
            itemId,
            {
                itemId,
                displayName: serviceItemDisplayNameV1(itemId),
                role: serviceItemRoleV1(itemId),
                productionUse: "customer_service_minigame"
            }
        ])));
    function businessServiceAnimationFamilyV1(cueId) {
        if (/gate|pad|token|key|jump|access|return/.test(cueId)) return "access_control";
        if (/spray|clean|decontam|barrel|cleanup/.test(cueId)) return "cleanup";
        if (/scan|calibrate|tune|stabilize|inspect|pulse|scope|crystal|lens/.test(cueId)) return "diagnostic";
        if (/dispatch|alarm|guard|salute|runner|flag/.test(cueId)) return "dispatch";
        if (/map|route|blueprint|measure|brief|estimate|sample|palette/.test(cueId)) return "planning";
        if (/stamp|paper|ledger|ticket|certificate|clipboard|permit/.test(cueId)) return "paperwork";
        if (/hammer|wrench|patch|tighten|sharpen|tool|blade|fixture/.test(cueId)) return "tool_work";
        return "counter_handoff";
    }
    function businessServiceAnimationChannelsV1(family) {
        switch(family){
            case "access_control":
                return [
                    "head",
                    "right_arm",
                    "left_arm",
                    "prop_ring"
                ];
            case "cleanup":
                return [
                    "body",
                    "right_arm",
                    "prop_spray",
                    "prop_container"
                ];
            case "diagnostic":
                return [
                    "head",
                    "right_arm",
                    "prop_scanner"
                ];
            case "dispatch":
                return [
                    "body",
                    "right_arm",
                    "left_arm",
                    "prop_signal"
                ];
            case "planning":
                return [
                    "head",
                    "right_arm",
                    "left_arm",
                    "prop_surface"
                ];
            case "paperwork":
                return [
                    "head",
                    "right_arm",
                    "prop_document"
                ];
            case "tool_work":
                return [
                    "body",
                    "right_arm",
                    "left_arm",
                    "prop_tool"
                ];
            case "counter_handoff":
                return [
                    "head",
                    "right_arm",
                    "left_arm",
                    "prop_item"
                ];
        }
    }
    function businessServiceAnimationDurationV1(family) {
        switch(family){
            case "access_control":
                return 1100;
            case "cleanup":
                return 1250;
            case "diagnostic":
                return 1e3;
            case "dispatch":
                return 900;
            case "planning":
                return 1050;
            case "paperwork":
                return 800;
            case "tool_work":
                return 1150;
            case "counter_handoff":
                return 750;
        }
    }
    var HARTHMERE_BUSINESS_SERVICE_ANIMATION_CUE_SPECS_V1 = Object.freeze(Object.fromEntries(Object.values(HARTHMERE_BUSINESS_MINIGAME_DEFINITIONS_V1).flatMap((definition2)=>definition2.offers.map((offer)=>{
            const family = businessServiceAnimationFamilyV1(offer.animationCue);
            return [
                offer.animationCue,
                {
                    cueId: offer.animationCue,
                    family,
                    durationMs: businessServiceAnimationDurationV1(family),
                    ownerChannels: businessServiceAnimationChannelsV1(family),
                    propMotion: offer.animationCue.replace(/^procedural_/, "").replace(/_/g, " "),
                    customerReaction: offer.satisfactionDelta >= 4 ? "delighted_accept" : offer.satisfactionDelta >= 3 ? "relieved_accept" : "quick_accept",
                    safety: {
                        procedural: true,
                        voxelSafe: true,
                        noRootMotion: true,
                        noSkeletonRequirement: true,
                        rotationOnlyPose: true
                    }
                }
            ];
        }))));
    function getHarthmereBusinessMiniGameDefinitionV1(typeId) {
        return HARTHMERE_BUSINESS_MINIGAME_DEFINITIONS_V1[typeId];
    }
    function defaultHarthmereBusinessCustomerStatsV1(businessId) {
        return {
            businessId,
            totalServed: 0,
            totalFailed: 0,
            lifetimeGold: 0,
            bestStreak: 0,
            currentTier: 1,
            serviceXp: 0,
            likeability: 0,
            friendshipPointsByNpcId: {},
            favoriteCustomerNpcIds: [],
            repeatCustomerMemories: [],
            thankYouNotes: [],
            collectiblesEarned: [],
            decorationUnlocks: [],
            badges: []
        };
    }
    function normalizeHarthmereBusinessCustomerStatsV1(raw, businessId) {
        const value = raw && typeof raw === "object" ? raw : {};
        const uniqueStrings = (rawValue, max = 50)=>Array.from(new Set(Array.isArray(rawValue) ? rawValue.filter((entry)=>typeof entry === "string" && entry.trim().length > 0) : [])).slice(-max);
        const friendship = value.friendshipPointsByNpcId && typeof value.friendshipPointsByNpcId === "object" ? Object.fromEntries(Object.entries(value.friendshipPointsByNpcId).map(([npcId, points])=>[
                npcId,
                Math.max(0, Math.trunc(Number(points) || 0))
            ])) : {};
        var _value_totalServed, _value_totalFailed, _value_lifetimeGold, _value_bestStreak, _value_currentTier, _value_serviceXp, _value_likeability;
        return {
            ...defaultHarthmereBusinessCustomerStatsV1(businessId),
            ...value,
            businessId,
            totalServed: Math.max(0, Math.trunc(Number((_value_totalServed = value.totalServed) !== null && _value_totalServed !== void 0 ? _value_totalServed : 0) || 0)),
            totalFailed: Math.max(0, Math.trunc(Number((_value_totalFailed = value.totalFailed) !== null && _value_totalFailed !== void 0 ? _value_totalFailed : 0) || 0)),
            lifetimeGold: Math.max(0, Math.trunc(Number((_value_lifetimeGold = value.lifetimeGold) !== null && _value_lifetimeGold !== void 0 ? _value_lifetimeGold : 0) || 0)),
            bestStreak: Math.max(0, Math.trunc(Number((_value_bestStreak = value.bestStreak) !== null && _value_bestStreak !== void 0 ? _value_bestStreak : 0) || 0)),
            currentTier: Math.max(1, Math.min(4, Math.trunc(Number((_value_currentTier = value.currentTier) !== null && _value_currentTier !== void 0 ? _value_currentTier : 1) || 1))),
            serviceXp: Math.max(0, Math.trunc(Number((_value_serviceXp = value.serviceXp) !== null && _value_serviceXp !== void 0 ? _value_serviceXp : 0) || 0)),
            likeability: Math.max(0, Math.min(100, Math.trunc(Number((_value_likeability = value.likeability) !== null && _value_likeability !== void 0 ? _value_likeability : 0) || 0))),
            friendshipPointsByNpcId: friendship,
            favoriteCustomerNpcIds: uniqueStrings(value.favoriteCustomerNpcIds, 25),
            repeatCustomerMemories: uniqueStrings(value.repeatCustomerMemories, 40),
            thankYouNotes: uniqueStrings(value.thankYouNotes, 40),
            collectiblesEarned: uniqueStrings(value.collectiblesEarned, 60),
            decorationUnlocks: uniqueStrings(value.decorationUnlocks, 60),
            badges: uniqueStrings(value.badges, 40),
            lastSessionAtMs: typeof value.lastSessionAtMs === "number" ? value.lastSessionAtMs : void 0,
            lastDailyServedDay: typeof value.lastDailyServedDay === "number" ? value.lastDailyServedDay : void 0
        };
    }
    function activeHarthmereBusinessCustomerTicketV1(session) {
        if (!session || session.status !== "active") return void 0;
        if (session.currentTicketId) {
            const current = session.queue.find((ticket)=>ticket.ticketId === session.currentTicketId && ticket.status === "waiting");
            if (current) return current;
        }
        return session.queue.find((ticket)=>ticket.status === "waiting");
    }
    function findHarthmereBusinessCustomerNpcV1(npcId) {
        return HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1.find((npc)=>npc.npcId === npcId);
    }
    var HARTHMERE_BUSINESS_OUTPOSTS_V1 = [
        {
            outpostId: "outpost_refinery_ashline",
            businessType: "exotic_matter_refinery",
            displayName: "Ashline Containment Works",
            ownerNpcId: "npc_outpost_ashline_foreman",
            townId: "harthmere_town",
            regionId: "harthmere_region",
            district: "Ashline Works",
            position: {
                x: 365,
                y: 65,
                z: -330,
                rot: 0
            },
            building: {
                profile: "dock_warehouse",
                width: 22,
                depth: 16,
                floors: 1,
                banner: "banner_blue"
            },
            job: {
                title: "Refinery Intake Hand",
                starterTask: "Sort sealed raw matter into cold bins.",
                rewardGold: 95,
                teaches: "Containment stock, safety ratings, and fuel customers."
            }
        },
        {
            outpostId: "outpost_biome_repair_north",
            businessType: "biome_maintenance_repair",
            displayName: "North Anchor Repair Shed",
            ownerNpcId: "npc_outpost_anchorwright",
            townId: "harthmere_town",
            regionId: "harthmere_region",
            district: "North Service Road",
            position: {
                x: 410,
                y: 65,
                z: -315,
                rot: 0.1
            },
            building: {
                profile: "workshop",
                width: 18,
                depth: 14,
                floors: 1,
                banner: "banner_green"
            },
            job: {
                title: "Anchor Apprentice",
                starterTask: "Carry repair kits and log climate readings.",
                rewardGold: 70,
                teaches: "Biome decay, maintenance subscriptions, and repair queues."
            }
        },
        {
            outpostId: "outpost_design_glassyard",
            businessType: "biome_design_studio",
            displayName: "Glassyard Biome Studio",
            ownerNpcId: "npc_outpost_glassyard_designer",
            townId: "harthmere_town",
            regionId: "harthmere_region",
            district: "Glassyard",
            position: {
                x: 455,
                y: 65,
                z: -332,
                rot: -0.1
            },
            building: {
                profile: "workshop",
                width: 16,
                depth: 14,
                floors: 1,
                banner: "banner_yellow"
            },
            job: {
                title: "Design Runner",
                starterTask: "Set sample boards for walk-in clients.",
                rewardGold: 60,
                teaches: "Taste matching, beauty demand, and showroom scaling."
            }
        },
        {
            outpostId: "outpost_security_redoubt",
            businessType: "security_defense_contractor",
            displayName: "Redoubt Contract Yard",
            ownerNpcId: "npc_outpost_redoubt_captain",
            townId: "harthmere_town",
            regionId: "harthmere_region",
            district: "Redoubt Yard",
            position: {
                x: 500,
                y: 65,
                z: -318,
                rot: Math.PI
            },
            building: {
                profile: "barracks",
                width: 20,
                depth: 14,
                floors: 2,
                banner: "banner_red"
            },
            job: {
                title: "Patrol Clerk",
                starterTask: "Post threat slips and issue signal flares.",
                rewardGold: 85,
                teaches: "Threat triage, guard contracts, and safety reputation."
            }
        },
        {
            outpostId: "outpost_portal_eastgate",
            businessType: "portal_transit_company",
            displayName: "Eastgate Portal Office",
            ownerNpcId: "npc_outpost_eastgate_operator",
            townId: "harthmere_town",
            regionId: "harthmere_region",
            district: "Eastgate Flats",
            position: {
                x: 545,
                y: 65,
                z: -334,
                rot: Math.PI / 2
            },
            building: {
                profile: "player_services",
                width: 24,
                depth: 18,
                floors: 2,
                banner: "banner_blue"
            },
            job: {
                title: "Gate Queue Attendant",
                starterTask: "Check passenger tickets against fuel seals.",
                rewardGold: 105,
                teaches: "Passenger/cargo lanes, fuel bottlenecks, and route uptime."
            }
        },
        {
            outpostId: "outpost_rare_foods_southplot",
            businessType: "biome_farming_rare_foods",
            displayName: "Southplot Rare Foods",
            ownerNpcId: "npc_outpost_southplot_grower",
            townId: "harthmere_town",
            regionId: "harthmere_region",
            district: "Southplot",
            position: {
                x: 590,
                y: 65,
                z: -318,
                rot: -Math.PI / 2
            },
            building: {
                profile: "provision",
                width: 18,
                depth: 14,
                floors: 1,
                banner: "banner_green"
            },
            job: {
                title: "Harvest Counter Hand",
                starterTask: "Weigh crop bundles and mark freshness tags.",
                rewardGold: 50,
                teaches: "Freshness, spoilage, and restaurant/clinic demand."
            }
        },
        {
            outpostId: "outpost_tools_cinderlane",
            businessType: "weapons_tools",
            displayName: "Cinderlane Tool Forge",
            ownerNpcId: "npc_outpost_cinderlane_smith",
            townId: "harthmere_town",
            regionId: "harthmere_region",
            district: "Cinderlane",
            position: {
                x: 635,
                y: 65,
                z: -334,
                rot: Math.PI / 2
            },
            building: {
                profile: "smithy",
                width: 20,
                depth: 16,
                floors: 2,
                banner: "banner_red"
            },
            job: {
                title: "Forge Helper",
                starterTask: "Sort repair tools and quench buckets.",
                rewardGold: 75,
                teaches: "Repairs, upgrades, and gear quality."
            }
        },
        {
            outpostId: "outpost_magic_moonstall",
            businessType: "magic_goods",
            displayName: "Moonstall Ward Shop",
            ownerNpcId: "npc_outpost_moonstall_warder",
            townId: "harthmere_town",
            regionId: "harthmere_region",
            district: "Moonstall",
            position: {
                x: 370,
                y: 65,
                z: -96,
                rot: 0
            },
            building: {
                profile: "magic_shop",
                width: 18,
                depth: 16,
                floors: 1,
                banner: "banner_blue"
            },
            job: {
                title: "Charm Shelf Assistant",
                starterTask: "Rotate unstable charms before they expire.",
                rewardGold: 90,
                teaches: "Unstable stock, wards, and rare components."
            }
        },
        {
            outpostId: "outpost_exploration_westtrail",
            businessType: "exploration_guide",
            displayName: "Westtrail Guide Table",
            ownerNpcId: "npc_outpost_westtrail_guide",
            townId: "harthmere_town",
            regionId: "harthmere_region",
            district: "Westtrail",
            position: {
                x: 415,
                y: 65,
                z: -112,
                rot: -0.2
            },
            building: {
                profile: "stable_office",
                width: 16,
                depth: 12,
                floors: 1,
                banner: "banner_brown"
            },
            job: {
                title: "Map Table Runner",
                starterTask: "Mark route hazards for guide customers.",
                rewardGold: 65,
                teaches: "Map freshness, safety, and expedition booking."
            }
        },
        {
            outpostId: "outpost_property_keylot",
            businessType: "custom_home_property_development",
            displayName: "Keylot Property Office",
            ownerNpcId: "npc_outpost_keylot_builder",
            townId: "harthmere_town",
            regionId: "harthmere_region",
            district: "Keylot",
            position: {
                x: 460,
                y: 65,
                z: -92,
                rot: 0.05
            },
            building: {
                profile: "workshop",
                width: 20,
                depth: 15,
                floors: 1,
                banner: "banner_brown"
            },
            job: {
                title: "Blueprint Clerk",
                starterTask: "Price wood, stone, and permit packets.",
                rewardGold: 80,
                teaches: "Staged builds, permits, and property scaling."
            }
        },
        {
            outpostId: "outpost_trader_brightcart",
            businessType: "general_trader",
            displayName: "Brightcart General House",
            ownerNpcId: "npc_outpost_brightcart_trader",
            townId: "harthmere_town",
            regionId: "harthmere_region",
            district: "Brightcart",
            position: {
                x: 505,
                y: 65,
                z: -108,
                rot: 0
            },
            building: {
                profile: "provision",
                width: 18,
                depth: 14,
                floors: 1,
                banner: "banner_yellow"
            },
            job: {
                title: "Stock Clerk",
                starterTask: "Restock rations and repair parts.",
                rewardGold: 45,
                teaches: "Shelf turns, price spreads, and brokerage."
            }
        },
        {
            outpostId: "outpost_hunter_ridgecooler",
            businessType: "hunter_wild_meat",
            displayName: "Ridgecooler Larder",
            ownerNpcId: "npc_outpost_ridgecooler_hunter",
            townId: "harthmere_town",
            regionId: "harthmere_region",
            district: "Ridgecooler",
            position: {
                x: 550,
                y: 65,
                z: -94,
                rot: Math.PI / 2
            },
            building: {
                profile: "dock_warehouse",
                width: 17,
                depth: 13,
                floors: 1,
                banner: "banner_brown"
            },
            job: {
                title: "Larder Hand",
                starterTask: "Wrap meat and count hide bundles.",
                rewardGold: 55,
                teaches: "Freshness, population pressure, and restaurant supply."
            }
        },
        {
            outpostId: "outpost_clinic_greenlamp",
            businessType: "medical_doctor",
            displayName: "Greenlamp Walk-In Clinic",
            ownerNpcId: "npc_outpost_greenlamp_doctor",
            townId: "harthmere_town",
            regionId: "harthmere_region",
            district: "Greenlamp",
            position: {
                x: 595,
                y: 65,
                z: -110,
                rot: Math.PI
            },
            building: {
                profile: "apothecary",
                width: 18,
                depth: 15,
                floors: 1,
                banner: "banner_green"
            },
            job: {
                title: "Clinic Aide",
                starterTask: "Prepare bandages and queue triage cards.",
                rewardGold: 70,
                teaches: "Triage, medicine stock, and trust."
            }
        },
        {
            outpostId: "outpost_teleport_returnstone",
            businessType: "teleport_owner",
            displayName: "Returnstone Pad Office",
            ownerNpcId: "npc_outpost_returnstone_keeper",
            townId: "harthmere_town",
            regionId: "harthmere_region",
            district: "Returnstone",
            position: {
                x: 640,
                y: 65,
                z: -96,
                rot: -Math.PI / 2
            },
            building: {
                profile: "stable_office",
                width: 16,
                depth: 13,
                floors: 1,
                banner: "banner_blue"
            },
            job: {
                title: "Pad Key Clerk",
                starterTask: "Issue access tokens and check fuel tags.",
                rewardGold: 95,
                teaches: "Access keys, pad stability, and private travel."
            }
        },
        {
            outpostId: "outpost_sanitation_clearbarrel",
            businessType: "waste_sanitation_cleanup",
            displayName: "Clearbarrel Cleanup Yard",
            ownerNpcId: "npc_outpost_clearbarrel_boss",
            townId: "harthmere_town",
            regionId: "harthmere_region",
            district: "Clearbarrel",
            position: {
                x: 665,
                y: 65,
                z: -160,
                rot: -Math.PI / 2
            },
            building: {
                profile: "wash_house",
                width: 18,
                depth: 14,
                floors: 1,
                banner: "banner_white"
            },
            job: {
                title: "Cleanup Loader",
                starterTask: "Seal barrels and sort cleaning reagent.",
                rewardGold: 60,
                teaches: "Sanitation, decontamination, and inspection trust."
            }
        },
        {
            outpostId: "outpost_repair_hingehall",
            businessType: "repair_maintenance_person",
            displayName: "Hingehall Repair Shop",
            ownerNpcId: "npc_outpost_hingehall_fixer",
            townId: "harthmere_town",
            regionId: "harthmere_region",
            district: "Hingehall",
            position: {
                x: 690,
                y: 65,
                z: -210,
                rot: Math.PI / 2
            },
            building: {
                profile: "workshop",
                width: 16,
                depth: 13,
                floors: 1,
                banner: "banner_brown"
            },
            job: {
                title: "Fix-It Apprentice",
                starterTask: "Prep nails and label broken fixtures.",
                rewardGold: 45,
                teaches: "Urgency, parts, and repair subscriptions."
            }
        },
        {
            outpostId: "outpost_restaurant_redpot",
            businessType: "food_service_restaurant",
            displayName: "Redpot Service Kitchen",
            ownerNpcId: "npc_outpost_redpot_cook",
            townId: "harthmere_town",
            regionId: "harthmere_region",
            district: "Redpot",
            position: {
                x: 666,
                y: 65,
                z: -260,
                rot: Math.PI
            },
            building: {
                profile: "bakery",
                width: 18,
                depth: 14,
                floors: 1,
                banner: "banner_red"
            },
            job: {
                title: "Line Server",
                starterTask: "Plate meals and wrap rations during rush.",
                rewardGold: 50,
                teaches: "Rush serving, menu stock, and sanitation pressure."
            }
        },
        {
            outpostId: "outpost_courier_stampspur",
            businessType: "courier",
            displayName: "Stampspur Courier Office",
            ownerNpcId: "npc_outpost_stampspur_dispatcher",
            townId: "harthmere_town",
            regionId: "harthmere_region",
            district: "Stampspur",
            position: {
                x: 335,
                y: 65,
                z: -210,
                rot: -Math.PI / 2
            },
            building: {
                profile: "stable_office",
                width: 16,
                depth: 13,
                floors: 1,
                banner: "banner_green"
            },
            job: {
                title: "Dispatch Runner",
                starterTask: "Weigh parcels and copy proof slips.",
                rewardGold: 45,
                teaches: "Deadlines, condition, and route batching."
            }
        },
        {
            outpostId: "outpost_hospitality_lanternrest",
            businessType: "hospitality_inn_hotel_shelter",
            displayName: "Lanternrest Road Inn",
            ownerNpcId: "npc_outpost_lanternrest_host",
            townId: "harthmere_town",
            regionId: "harthmere_region",
            district: "Lanternrest",
            position: {
                x: 335,
                y: 65,
                z: -265,
                rot: 0
            },
            building: {
                profile: "inn",
                width: 24,
                depth: 18,
                floors: 2,
                banner: "banner_yellow"
            },
            job: {
                title: "Front Desk Helper",
                starterTask: "Assign room keys and count clean linen.",
                rewardGold: 65,
                teaches: "Occupancy, cleaning, food, and shelter trust."
            }
        }
    ];
    function harthmereBusinessOutpostMapMarkerIdV1(outpostId) {
        return `harthmere_business_${outpostId}`;
    }
    function harthmereOutpostStructureTypeForProfileV1(profile) {
        if (profile === "dock_warehouse" || profile === "inn" || profile === "barracks" || profile === "player_services") return "warehouse";
        if (profile === "bakery" || profile === "provision") return "shop";
        return "workshop";
    }
    function harthmereOutpostPlotTypeForStructureV1(structureTypeId) {
        return structureTypeId === "workshop" ? "crafting" : "commercial";
    }
    function harthmereOutpostRotationDegreesV1(rot) {
        const normalized = (rot % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        const quarter = Math.round(normalized / (Math.PI / 2)) % 4;
        return [
            0,
            90,
            180,
            270
        ][quarter];
    }
    function harthmereOutpostOriginV1(outpost) {
        return {
            x: Math.round(outpost.position.x - outpost.building.width / 2),
            y: Math.floor(outpost.position.y),
            z: Math.round(outpost.position.z - outpost.building.depth / 2)
        };
    }
    function harthmereOutpostBlueprintForV1(outpost) {
        const structureTypeId = harthmereOutpostStructureTypeForProfileV1(outpost.building.profile);
        return {
            blueprintId: `${outpost.outpostId}_backend_voxel_blueprint`,
            displayName: outpost.displayName,
            plotType: harthmereOutpostPlotTypeForStructureV1(structureTypeId),
            use: "business",
            structureTypeId,
            goldCost: 0,
            storageSlots: Math.max(24, outpost.building.width * outpost.building.floors),
            service: `${outpost.displayName} customer service counter and job-training outpost.`,
            footprint: {
                width: outpost.building.width,
                depth: outpost.building.depth,
                height: Math.max(5, outpost.building.floors * 4 + 1)
            },
            materialStages: {},
            laborStages: {},
            description: "Server-owned procedural voxel business building. Structural floors, walls, roof, foundation, and entrance are generated by the backend building materialization plan."
        };
    }
    function harthmereOutpostPlotForV1(outpost, blueprint) {
        const origin = harthmereOutpostOriginV1(outpost);
        const margin = 8;
        return {
            plotId: `${outpost.outpostId}_backend_plot`,
            displayName: `${outpost.displayName} Plot`,
            area: "harthmere",
            district: outpost.district,
            plotType: blueprint.plotType,
            allowedUses: [
                "business"
            ],
            allowedBlueprintIds: [
                blueprint.blueprintId
            ],
            claimPriceGold: 0,
            taxRate: 0,
            bounds: {
                xMin: origin.x - margin,
                xMax: origin.x + blueprint.footprint.width + margin,
                zMin: origin.z - margin,
                zMax: origin.z + blueprint.footprint.depth + margin
            },
            groundY: origin.y,
            startsMucked: false,
            safeAfterPurchase: false,
            maxStructureHeight: Math.max(blueprint.footprint.height + 3, 10),
            maxCoveredAreaFraction: 0.75,
            requiresRoadAccess: true,
            roadAccessDistanceVoxels: 6,
            terrainType: "stone",
            description: "Backend-generated Harthmere business outpost lot with public entrance, customer queue, service counter, jobs board clearance, and NPC walk path metadata."
        };
    }
    function createHarthmereBusinessOutpostProceduralBuildingV1(outpost, activatedAtMs = 0) {
        ensureBuildingSystemStructureDefinitionsV1();
        const blueprint = harthmereOutpostBlueprintForV1(outpost);
        const plot = harthmereOutpostPlotForV1(outpost, blueprint);
        const origin = harthmereOutpostOriginV1(outpost);
        const doorX = origin.x + Math.floor(blueprint.footprint.width / 2);
        const entrance = {
            x: doorX,
            y: origin.y + 1,
            z: origin.z - 1
        };
        const queueNode = {
            x: doorX,
            y: origin.y + 1,
            z: origin.z + 2
        };
        const serviceCounter = {
            x: doorX,
            y: origin.y + 1,
            z: origin.z + Math.max(4, Math.floor(blueprint.footprint.depth * 0.48))
        };
        const exitNode = {
            x: Math.min(origin.x + blueprint.footprint.width - 3, doorX + 2),
            y: origin.y + 1,
            z: origin.z + 1
        };
        const materializationPlan = createBuildingSystemMaterializationPlanV1({
            requestId: `${outpost.outpostId}_backend_materialization`,
            actorId: outpost.ownerNpcId,
            plot,
            blueprint,
            origin,
            rotationDegrees: harthmereOutpostRotationDegreesV1(outpost.position.rot),
            activatedAtMs
        });
        const jobsBoardPosition = {
            x: entrance.x + 3,
            y: origin.y,
            z: origin.z - 3
        };
        materializationPlan.inWorldMarkers = [
            {
                markerId: `${outpost.outpostId}:business-counter`,
                plotId: plot.plotId,
                kind: "business_marker",
                position: [
                    serviceCounter.x,
                    serviceCounter.y,
                    serviceCounter.z
                ],
                label: `${outpost.displayName} counter`,
                createdAtMs: activatedAtMs
            },
            {
                markerId: `${outpost.outpostId}:jobs-board`,
                plotId: plot.plotId,
                kind: "npc_board",
                position: [
                    jobsBoardPosition.x,
                    jobsBoardPosition.y,
                    jobsBoardPosition.z
                ],
                label: `${outpost.displayName} jobs board`,
                createdAtMs: activatedAtMs
            }
        ];
        const countLabel = (label)=>materializationPlan.edits.filter((edit)=>edit.label === label).length;
        const customerSpace = {
            minX: origin.x + 2,
            maxX: origin.x + blueprint.footprint.width - 2,
            minZ: origin.z + 2,
            maxZ: origin.z + blueprint.footprint.depth - 3
        };
        return {
            buildingId: `${outpost.outpostId}_backend_voxel_building`,
            outpostId: outpost.outpostId,
            businessType: outpost.businessType,
            displayName: outpost.displayName,
            serverOwned: true,
            sourceOfTruth: "backend_procedural_voxel_building",
            generationMode: "building_system_materialization_plan",
            plot,
            blueprint,
            origin,
            rotationDegrees: materializationPlan.rotationDegrees,
            entrance,
            queueNode,
            serviceCounter,
            exitNode,
            customerSpace: {
                ...customerSpace,
                areaMeters: Math.max(0, customerSpace.maxX - customerSpace.minX) * Math.max(0, customerSpace.maxZ - customerSpace.minZ)
            },
            clearances: {
                frontDoorMeters: 2,
                shopCustomerSpaceMeters: 4,
                publicEntranceMeters: 3
            },
            jobsBoardPosition,
            materializationPlan,
            structuralAudit: {
                materializesSolidVoxelBuilding: true,
                foundationEdits: countLabel("foundation"),
                floorEdits: countLabel("floor"),
                wallEdits: countLabel("wall"),
                roofEdits: countLabel("roof"),
                stairEdits: countLabel("stair")
            }
        };
    }
    var HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS_V1 = Object.freeze(Object.fromEntries(HARTHMERE_BUSINESS_OUTPOSTS_V1.map((outpost)=>[
            outpost.outpostId,
            createHarthmereBusinessOutpostProceduralBuildingV1(outpost)
        ])));
    var HARTHMERE_BUSINESS_OUTPOST_MAP_MARKERS_V1 = Object.freeze(HARTHMERE_BUSINESS_OUTPOSTS_V1.map((outpost)=>{
        const building = HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS_V1[outpost.outpostId];
        const definition2 = HARTHMERE_BUSINESS_MINIGAME_DEFINITIONS_V1[outpost.businessType];
        var _building_entrance;
        const entrance = (_building_entrance = building === null || building === void 0 ? void 0 : building.entrance) !== null && _building_entrance !== void 0 ? _building_entrance : outpost.position;
        return {
            markerId: harthmereBusinessOutpostMapMarkerIdV1(outpost.outpostId),
            outpostId: outpost.outpostId,
            businessType: outpost.businessType,
            label: outpost.displayName,
            description: `Harthmere business in ${outpost.district}. Go inside for ${definition2.interfaceTitle} service and ${outpost.job.title} shifts.`,
            area: "Harthmere",
            district: outpost.district,
            position: [
                entrance.x,
                entrance.y,
                entrance.z
            ],
            kind: "business_outpost",
            visibleOnWorldMap: true,
            visibleOnHudMap: true,
            jobTitle: outpost.job.title,
            interfaceTitle: definition2.interfaceTitle
        };
    }));
    // src/client/components/harthmere_business/businessInterfaceLiveAdapter.ts
    var HARTHMERE_BUSINESS_TYPE_ORDER_V1 = [
        "exotic_matter_refinery",
        "biome_maintenance_repair",
        "biome_design_studio",
        "security_defense_contractor",
        "portal_transit_company",
        "biome_farming_rare_foods",
        "weapons_tools",
        "magic_goods",
        "exploration_guide",
        "custom_home_property_development",
        "general_trader",
        "hunter_wild_meat",
        "medical_doctor",
        "teleport_owner",
        "waste_sanitation_cleanup",
        "repair_maintenance_person",
        "food_service_restaurant",
        "courier",
        "hospitality_inn_hotel_shelter"
    ];
    var HARTHMERE_BUSINESS_SERVICE_ACTIONS_V1 = {
        exotic_matter_refinery: [
            {
                actionId: "refine",
                label: "Stabilize Matter",
                description: "Convert raw Exotic Matter into safe industrial stock.",
                audience: "owner",
                operation: "run_exotic_refinery_cycle",
                defaultPayload: {
                    itemId: "raw_exotic_matter",
                    count: 1
                }
            },
            {
                actionId: "certify_fuel",
                label: "Certify Portal Fuel",
                description: "Certify stabilized fuel for portal and teleport operators.",
                audience: "owner",
                operation: "certify_portal_fuel",
                defaultPayload: {
                    itemId: "portal_fuel",
                    count: 1
                }
            },
            {
                actionId: "request_fuel",
                label: "Request Fuel Order",
                description: "Place an escrowed order for certified portal fuel.",
                audience: "customer",
                operation: "create_contract",
                serviceNeed: "energy",
                rewardGold: 160
            }
        ],
        biome_maintenance_repair: [
            {
                actionId: "repair_biome",
                label: "Repair Biome Anchor",
                description: "Fix weather failure, anchor drift, and timeline leakage.",
                audience: "owner",
                operation: "perform_biome_maintenance"
            },
            {
                actionId: "inspect_biome",
                label: "Request Inspection",
                description: "Ask for a property inspection or emergency repair visit.",
                audience: "customer",
                operation: "create_contract",
                serviceNeed: "maintenance",
                rewardGold: 110
            }
        ],
        biome_design_studio: [
            {
                actionId: "install_theme",
                label: "Install Design Package",
                description: "Install decor/theme work that raises beauty and property value.",
                audience: "owner",
                operation: "install_biome_design",
                defaultPayload: {
                    amountGold: 120
                }
            },
            {
                actionId: "request_redesign",
                label: "Request Redesign",
                description: "Commission decor, terrain, lighting, or theme work.",
                audience: "customer",
                operation: "create_contract",
                serviceNeed: "identity",
                rewardGold: 130
            }
        ],
        security_defense_contractor: [
            {
                actionId: "resolve_threat",
                label: "Resolve Threat",
                description: "Clear a world threat using real combat gear.",
                audience: "owner",
                operation: "resolve_security_threat"
            },
            {
                actionId: "hire_guard",
                label: "Hire Protection",
                description: "Request guards, monster removal, patrols, or escort work.",
                audience: "customer",
                operation: "create_contract",
                serviceNeed: "safety",
                rewardGold: 150
            }
        ],
        portal_transit_company: [
            {
                actionId: "build_portal",
                label: "Build Endpoint",
                description: "Build a route endpoint and establish portal ownership.",
                audience: "owner",
                operation: "build_portal_endpoint",
                defaultPayload: {
                    originTownId: "harthmere_grove",
                    destinationTownId: "harthmere_outskirts",
                    amountGold: 35
                }
            },
            {
                actionId: "run_transit",
                label: "Run Transit",
                description: "Operate passenger or cargo transit and collect fares.",
                audience: "both",
                operation: "run_portal_transit",
                defaultPayload: {
                    count: 1
                }
            }
        ],
        biome_farming_rare_foods: [
            {
                actionId: "plant_crop",
                label: "Plant Crop",
                description: "Plant a climate-dependent crop node.",
                audience: "owner",
                operation: "plant_crop_node",
                defaultPayload: {
                    itemId: "rare_seed",
                    count: 1
                }
            },
            {
                actionId: "harvest",
                label: "Harvest Crops",
                description: "Harvest grown crops into business inventory.",
                audience: "owner",
                operation: "harvest_crop_node"
            },
            {
                actionId: "order_produce",
                label: "Order Produce",
                description: "Order crops, herbs, or rare food supply.",
                audience: "customer",
                operation: "create_contract",
                serviceNeed: "food",
                rewardGold: 90
            }
        ],
        weapons_tools: [
            {
                actionId: "repair_item",
                label: "Repair Item",
                description: "Repair durable tools, weapons, or work equipment.",
                audience: "owner",
                operation: "repair_durable_item"
            },
            {
                actionId: "upgrade_item",
                label: "Upgrade Gear",
                description: "Upgrade eligible tools or weapons with permit checks.",
                audience: "owner",
                operation: "upgrade_durable_item"
            },
            {
                actionId: "request_repair",
                label: "Request Repair",
                description: "Submit a repair or equipment commission.",
                audience: "customer",
                operation: "create_contract",
                serviceNeed: "maintenance",
                rewardGold: 85
            }
        ],
        magic_goods: [
            {
                actionId: "craft_magic",
                label: "Craft Magic Good",
                description: "Craft unstable consumables, charms, or wards.",
                audience: "owner",
                operation: "craft_magic_good",
                defaultPayload: {
                    itemId: "unstable_charm",
                    count: 1
                }
            },
            {
                actionId: "install_ward",
                label: "Install Ward",
                description: "Install a protective ward on a property.",
                audience: "owner",
                operation: "install_ward",
                defaultPayload: {
                    amountGold: 110
                }
            },
            {
                actionId: "request_ward",
                label: "Request Ward",
                description: "Commission wards, charms, potions, or anomaly help.",
                audience: "customer",
                operation: "create_contract",
                serviceNeed: "timeline_stability",
                rewardGold: 140
            }
        ],
        exploration_guide: [
            {
                actionId: "discover_route",
                label: "Discover Route",
                description: "Discover or register a route through unstable terrain.",
                audience: "owner",
                operation: "discover_exploration_route",
                defaultPayload: {
                    originTownId: "harthmere_grove",
                    destinationTownId: "rift_field",
                    safetyRating: 65
                }
            },
            {
                actionId: "lead_expedition",
                label: "Lead Expedition",
                description: "Guide clients on a risk-managed expedition.",
                audience: "owner",
                operation: "lead_expedition"
            },
            {
                actionId: "book_expedition",
                label: "Book Expedition",
                description: "Request route advice, a guided trip, or a danger read.",
                audience: "customer",
                operation: "create_contract",
                serviceNeed: "knowledge",
                rewardGold: 125
            }
        ],
        custom_home_property_development: [
            {
                actionId: "start_project",
                label: "Start Project",
                description: "Start staged construction tied to real property state.",
                audience: "owner",
                operation: "start_property_project",
                defaultPayload: {
                    amountGold: 300
                }
            },
            {
                actionId: "advance_project",
                label: "Advance Build",
                description: "Advance construction stages using funds and materials.",
                audience: "owner",
                operation: "advance_property_project",
                defaultPayload: {
                    amountGold: 250
                }
            },
            {
                actionId: "request_build",
                label: "Request Build",
                description: "Commission construction, renovation, or demolition.",
                audience: "customer",
                operation: "create_contract",
                serviceNeed: "housing",
                rewardGold: 350
            }
        ],
        general_trader: [
            {
                actionId: "refresh_inventory",
                label: "Refresh Stock",
                description: "Restock inventory from wholesale and trade networks.",
                audience: "owner",
                operation: "refresh_trader_inventory",
                defaultPayload: {
                    amountGold: 75
                }
            },
            {
                actionId: "arbitrage",
                label: "Run Arbitrage",
                description: "Move goods between regions for price spread profit.",
                audience: "owner",
                operation: "perform_regional_arbitrage",
                defaultPayload: {
                    itemId: "trade_goods",
                    count: 4
                }
            },
            {
                actionId: "request_goods",
                label: "Request Goods",
                description: "Place an order for common goods or brokerage.",
                audience: "customer",
                operation: "create_contract",
                serviceNeed: "logistics",
                rewardGold: 75
            }
        ],
        hunter_wild_meat: [
            {
                actionId: "hunt",
                label: "Hunt Wildlife",
                description: "Hunt from a real wildlife population with protected-species checks.",
                audience: "owner",
                operation: "hunt_wildlife"
            },
            {
                actionId: "order_meat",
                label: "Order Meat",
                description: "Order wild meat, hides, bones, or pest control.",
                audience: "customer",
                operation: "create_contract",
                serviceNeed: "food",
                rewardGold: 95
            }
        ],
        medical_doctor: [
            {
                actionId: "register_patient",
                label: "Register Patient",
                description: "Record a patient illness or injury state.",
                audience: "owner",
                operation: "register_patient",
                defaultPayload: {
                    severity: 3,
                    cause: "walk_in"
                }
            },
            {
                actionId: "treat_patient",
                label: "Treat Patient",
                description: "Treat patient illness or injury with success/failure outcomes.",
                audience: "owner",
                operation: "treat_patient"
            },
            {
                actionId: "request_care",
                label: "Request Care",
                description: "Request treatment, checkup, medicine, or emergency care.",
                audience: "customer",
                operation: "create_contract",
                serviceNeed: "health",
                rewardGold: 120
            }
        ],
        teleport_owner: [
            {
                actionId: "build_pad",
                label: "Build Pad",
                description: "Register a teleport pad and destination.",
                audience: "owner",
                operation: "build_teleport_pad",
                defaultPayload: {
                    locationId: "business_front",
                    destinationTownId: "harthmere_grove",
                    amountGold: 40
                }
            },
            {
                actionId: "issue_key",
                label: "Issue Access Key",
                description: "Grant destination access to a customer or guildmate.",
                audience: "owner",
                operation: "issue_teleport_access_key"
            },
            {
                actionId: "use_pad",
                label: "Use Teleport",
                description: "Use a fuel-backed teleport pad.",
                audience: "both",
                operation: "use_teleport_pad"
            }
        ],
        waste_sanitation_cleanup: [
            {
                actionId: "accumulate_waste",
                label: "Record Waste",
                description: "Record accumulated waste or contamination at a site.",
                audience: "owner",
                operation: "accumulate_waste",
                defaultPayload: {
                    severity: 3,
                    cause: "business_waste"
                }
            },
            {
                actionId: "cleanup",
                label: "Clean Site",
                description: "Clean contamination and lower outbreak risk.",
                audience: "owner",
                operation: "cleanup_contamination_site"
            },
            {
                actionId: "request_cleanup",
                label: "Request Cleanup",
                description: "Request trash pickup, cleanup, compost, or decontamination.",
                audience: "customer",
                operation: "create_contract",
                serviceNeed: "sanitation",
                rewardGold: 100
            }
        ],
        repair_maintenance_person: [
            {
                actionId: "repair_fixture",
                label: "Repair Fixture",
                description: "Repair object, furniture, tool, or building fixture state.",
                audience: "owner",
                operation: "repair_fixture",
                defaultPayload: {
                    itemId: "broken_fixture",
                    amountGold: 40
                }
            },
            {
                actionId: "request_maintenance",
                label: "Request Maintenance",
                description: "Request repair of items, furniture, fixtures, or facilities.",
                audience: "customer",
                operation: "create_contract",
                serviceNeed: "maintenance",
                rewardGold: 70
            }
        ],
        food_service_restaurant: [
            {
                actionId: "set_menu",
                label: "Set Menu",
                description: "Rotate menus and published meal offerings.",
                audience: "owner",
                operation: "set_restaurant_menu",
                defaultPayload: {
                    inventoryItemDeltas: {
                        worker_meal: 1
                    }
                }
            },
            {
                actionId: "serve_day",
                label: "Serve Day",
                description: "Serve customers using ingredients, sanitation, and freshness.",
                audience: "owner",
                operation: "serve_restaurant_day",
                defaultPayload: {
                    count: 8
                }
            },
            {
                actionId: "order_meal",
                label: "Order Meal",
                description: "Order meals, rations, catering, or buff food.",
                audience: "customer",
                operation: "create_contract",
                serviceNeed: "food",
                rewardGold: 55
            }
        ],
        courier: [
            {
                actionId: "create_delivery",
                label: "Create Delivery",
                description: "Create an escrow-backed package delivery.",
                audience: "both",
                operation: "create_delivery",
                defaultPayload: {
                    itemId: "parcel",
                    count: 1,
                    rewardGold: 45
                }
            },
            {
                actionId: "complete_delivery",
                label: "Complete Delivery",
                description: "Complete active delivery and release escrow.",
                audience: "owner",
                operation: "complete_delivery"
            },
            {
                actionId: "request_delivery",
                label: "Request Courier",
                description: "Request mail, package, medicine, or food delivery.",
                audience: "customer",
                operation: "create_contract",
                serviceNeed: "logistics",
                rewardGold: 65
            }
        ],
        hospitality_inn_hotel_shelter: [
            {
                actionId: "create_rooms",
                label: "Create Rooms",
                description: "Create lodging state for rooms, shelter beds, and occupancy.",
                audience: "owner",
                operation: "create_hospitality_state",
                defaultPayload: {
                    count: 4
                }
            },
            {
                actionId: "run_day",
                label: "Run Hospitality Day",
                description: "Update occupancy, guest safety, revenue, and cleanliness.",
                audience: "owner",
                operation: "run_hospitality_day"
            },
            {
                actionId: "clean_rooms",
                label: "Clean Rooms",
                description: "Clean rooms and improve lodging quality.",
                audience: "owner",
                operation: "clean_hospitality_rooms"
            },
            {
                actionId: "book_room",
                label: "Book Room / Shelter",
                description: "Request lodging, shelter beds, meeting room, or safehouse stay.",
                audience: "customer",
                operation: "create_contract",
                serviceNeed: "housing",
                rewardGold: 80
            }
        ]
    };
    function jsonRecord(value) {
        return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    }
    function titleCaseBusinessText(value) {
        return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_:./-]+/g, " ").replace(/\s+/g, " ").trim().replace(/\b\w/g, (char)=>char.toUpperCase());
    }
    function formatHarthmereBusinessPlayerWarningV1(rawWarning) {
        const warning = String(rawWarning !== null && rawWarning !== void 0 ? rawWarning : "").trim();
        if (!warning) return "Something needs attention.";
        if (warning.includes("business_item_required:")) {
            var _warning_split_pop;
            const item = (_warning_split_pop = warning.split(":").pop()) !== null && _warning_split_pop !== void 0 ? _warning_split_pop : "stock";
            return `Stock is missing ${titleCaseBusinessText(item)}.`;
        }
        if (warning.includes("business_customer_session_already_active")) return "A customer shift is already running.";
        if (warning.includes("business_customer_session_expired")) return "That customer shift has expired.";
        if (warning.includes("business_customer_left_waiting")) return "A customer left after waiting too long.";
        if (warning.includes("business_branch_requires_tier_3")) return "Serve more customers before opening a branch.";
        if (warning.includes("business_branch_funds_insufficient")) return "The business needs more funds before opening that branch.";
        if (warning.includes("business_branch_outpost_already_claimed")) return "That branch site is already claimed.";
        if (warning.includes("branch_warehouse_full")) return "The branch warehouse is full.";
        if (warning.includes("branch_staff_slots_full")) return "That branch has no more staff slots.";
        if (warning.includes("active_business_branch_required")) return "Choose an active branch first.";
        if (warning.includes("employee_morale")) return "A worker needs rest before service quality drops.";
        if (warning.includes("employee_resigned")) return "A worker resigned after morale stayed too low.";
        var _warning_replace_replace_split_filter_pop;
        const cleaned = (_warning_replace_replace_split_filter_pop = warning.replace(/^economy_(rejected|warning):/g, "").replace(/^jobs_board_rejected:/g, "").split(":").filter(Boolean).pop()) !== null && _warning_replace_replace_split_filter_pop !== void 0 ? _warning_replace_replace_split_filter_pop : warning;
        return titleCaseBusinessText(cleaned);
    }
    function normalizeSystems(raw) {
        const r = jsonRecord(raw);
        return {
            permissions: jsonRecord(r.permissions),
            bankAccounts: jsonRecord(r.bankAccounts),
            propertyIntegrations: jsonRecord(r.propertyIntegrations),
            biomeAnchors: jsonRecord(r.biomeAnchors),
            threats: jsonRecord(r.threats),
            portalEndpoints: jsonRecord(r.portalEndpoints),
            teleportPads: jsonRecord(r.teleportPads),
            cropNodes: jsonRecord(r.cropNodes),
            animalPopulations: jsonRecord(r.animalPopulations),
            contaminationSites: jsonRecord(r.contaminationSites),
            patients: jsonRecord(r.patients),
            durableItems: jsonRecord(r.durableItems),
            explorationRoutes: jsonRecord(r.explorationRoutes),
            deliveries: jsonRecord(r.deliveries),
            hospitality: jsonRecord(r.hospitality),
            menuByBusiness: jsonRecord(r.menuByBusiness),
            unstableMagicItems: jsonRecord(r.unstableMagicItems),
            serviceQuests: jsonRecord(r.serviceQuests),
            customerSessions: jsonRecord(r.customerSessions),
            customerStats: Object.fromEntries(Object.entries(jsonRecord(r.customerStats)).map(([businessId, stats])=>[
                    businessId,
                    normalizeHarthmereBusinessCustomerStatsV1(stats, businessId)
                ])),
            outpostBuildings: jsonRecord(r.outpostBuildings),
            empireBranches: jsonRecord(r.empireBranches),
            branchDashboards: jsonRecord(r.branchDashboards),
            automationAssignments: jsonRecord(r.automationAssignments),
            employeeCandidates: jsonRecord(r.employeeCandidates),
            employeeTaskRuns: jsonRecord(r.employeeTaskRuns),
            balanceReports: Array.isArray(r.balanceReports) ? r.balanceReports : []
        };
    }
    function normalizeHarthmereBusinessEconomySnapshotV1(raw) {
        const snapshot = jsonRecord(raw);
        const businesses = jsonRecord(snapshot.businesses);
        var _snapshot_actorId;
        const actorId = String((_snapshot_actorId = snapshot.actorId) !== null && _snapshot_actorId !== void 0 ? _snapshot_actorId : "");
        const myBusinesses = Array.isArray(snapshot.myBusinesses) ? snapshot.myBusinesses : Object.values(businesses).filter((business2)=>business2.ownerKind === "player" && business2.ownerId === actorId);
        return {
            version: typeof snapshot.version === "string" ? snapshot.version : void 0,
            actorId,
            businessTypes: jsonRecord(snapshot.businessTypes),
            recipeCatalog: jsonRecord(snapshot.recipeCatalog),
            businesses,
            myBusinesses,
            openContracts: Array.isArray(snapshot.openContracts) ? snapshot.openContracts : [],
            activeContracts: Array.isArray(snapshot.activeContracts) ? snapshot.activeContracts : [],
            customerContracts: Array.isArray(snapshot.customerContracts) ? snapshot.customerContracts : void 0,
            employees: jsonRecord(snapshot.employees),
            loans: jsonRecord(snapshot.loans),
            insurancePolicies: jsonRecord(snapshot.insurancePolicies),
            tradeRoutes: jsonRecord(snapshot.tradeRoutes),
            failures: jsonRecord(snapshot.failures),
            marketOrders: jsonRecord(snapshot.marketOrders),
            towns: jsonRecord(snapshot.towns),
            regions: jsonRecord(snapshot.regions),
            businessSystems: normalizeSystems(snapshot.businessSystems),
            balanceWarnings: Array.isArray(snapshot.balanceWarnings) ? snapshot.balanceWarnings : [],
            ledger: Array.isArray(snapshot.ledger) ? snapshot.ledger : []
        };
    }
    function isHarthmereBusinessInterfaceAvailableV1(state, nearbyBusinessId) {
        if (!state || !nearbyBusinessId) return false;
        const business2 = state.businesses[nearbyBusinessId];
        if (!business2) return false;
        const mode = getHarthmereBusinessActorModeV1(state, nearbyBusinessId);
        return mode === "owner" || canCustomerUseHarthmereBusinessV1(business2);
    }
    function getHarthmereBusinessActorModeV1(state, businessId) {
        var _businessId;
        const business2 = state.businesses[businessId];
        var _state_businessSystems_permissions, _businessId_state_actorId;
        const permissions = (_businessId_state_actorId = (_businessId = ((_state_businessSystems_permissions = state.businessSystems.permissions) !== null && _state_businessSystems_permissions !== void 0 ? _state_businessSystems_permissions : {})[businessId]) === null || _businessId === void 0 ? void 0 : _businessId[state.actorId]) !== null && _businessId_state_actorId !== void 0 ? _businessId_state_actorId : [];
        if (!business2) return "customer";
        if (business2.ownerKind === "player" && business2.ownerId === state.actorId) return "owner";
        if (permissions.includes("owner_admin") || permissions.length > 0) return "owner";
        return "customer";
    }
    function canCustomerUseHarthmereBusinessV1(business2) {
        return (business2 === null || business2 === void 0 ? void 0 : business2.status) === "open";
    }
    function itemPrice(state, business2, itemId) {
        var _region_priceIndex, _business2_priceModifiers;
        const region = business2.regionId ? state.regions[business2.regionId] : void 0;
        var _region_priceIndex_itemId;
        const base = Number((_region_priceIndex_itemId = region === null || region === void 0 ? void 0 : (_region_priceIndex = region.priceIndex) === null || _region_priceIndex === void 0 ? void 0 : _region_priceIndex[itemId]) !== null && _region_priceIndex_itemId !== void 0 ? _region_priceIndex_itemId : 10);
        var _business2_priceModifiers_itemId;
        const modifier = Number((_business2_priceModifiers_itemId = (_business2_priceModifiers = business2.priceModifiers) === null || _business2_priceModifiers === void 0 ? void 0 : _business2_priceModifiers[itemId]) !== null && _business2_priceModifiers_itemId !== void 0 ? _business2_priceModifiers_itemId : 1);
        return Math.max(1, Math.round(base * modifier));
    }
    function getHarthmereVisibleBusinessInventoryV1(state, businessId) {
        const business2 = state.businesses[businessId];
        if (!business2) return [];
        var _business2_inventory;
        return Object.values((_business2_inventory = business2.inventory) !== null && _business2_inventory !== void 0 ? _business2_inventory : {}).filter((stack)=>stack.count > 0).map((stack)=>({
                ...stack,
                priceGold: itemPrice(state, business2, stack.itemId)
            })).sort((a, b)=>a.itemId.localeCompare(b.itemId));
    }
    function getHarthmereBusinessBankAccountV1(state, businessId) {
        var _state_businessSystems_bankAccounts;
        return Object.values((_state_businessSystems_bankAccounts = state.businessSystems.bankAccounts) !== null && _state_businessSystems_bankAccounts !== void 0 ? _state_businessSystems_bankAccounts : {}).find((account)=>account.businessId === businessId);
    }
    function getHarthmereBusinessMoneySummaryV1(state, businessId) {
        const business2 = state.businesses[businessId];
        const bank = getHarthmereBusinessBankAccountV1(state, businessId);
        var _business2_balanceGold, _bank_balanceGold, _business2_debtGold, _business2_upkeepGoldPerDay, _business2_rentGoldPerDay, _business2_wageGoldPerDay, _business2_salesTaxRate;
        return {
            balanceGold: (_business2_balanceGold = business2 === null || business2 === void 0 ? void 0 : business2.balanceGold) !== null && _business2_balanceGold !== void 0 ? _business2_balanceGold : 0,
            bankBalanceGold: (_bank_balanceGold = bank === null || bank === void 0 ? void 0 : bank.balanceGold) !== null && _bank_balanceGold !== void 0 ? _bank_balanceGold : 0,
            debtGold: (_business2_debtGold = business2 === null || business2 === void 0 ? void 0 : business2.debtGold) !== null && _business2_debtGold !== void 0 ? _business2_debtGold : 0,
            dailyUpkeepGold: (_business2_upkeepGoldPerDay = business2 === null || business2 === void 0 ? void 0 : business2.upkeepGoldPerDay) !== null && _business2_upkeepGoldPerDay !== void 0 ? _business2_upkeepGoldPerDay : 0,
            dailyRentGold: (_business2_rentGoldPerDay = business2 === null || business2 === void 0 ? void 0 : business2.rentGoldPerDay) !== null && _business2_rentGoldPerDay !== void 0 ? _business2_rentGoldPerDay : 0,
            dailyWagesGold: (_business2_wageGoldPerDay = business2 === null || business2 === void 0 ? void 0 : business2.wageGoldPerDay) !== null && _business2_wageGoldPerDay !== void 0 ? _business2_wageGoldPerDay : 0,
            salesTaxRate: (_business2_salesTaxRate = business2 === null || business2 === void 0 ? void 0 : business2.salesTaxRate) !== null && _business2_salesTaxRate !== void 0 ? _business2_salesTaxRate : 0
        };
    }
    function getHarthmereBusinessContractsV1(state, businessId) {
        const fromOpen = state.openContracts.filter((contract)=>{
            var _state_businesses_businessId;
            return contract.acceptedByBusinessId === businessId || contract.businessType === ((_state_businesses_businessId = state.businesses[businessId]) === null || _state_businesses_businessId === void 0 ? void 0 : _state_businesses_businessId.typeId);
        });
        const fromActive = state.activeContracts.filter((contract)=>contract.acceptedByBusinessId === businessId);
        const seen = /* @__PURE__ */ new Set();
        return [
            ...fromActive,
            ...fromOpen
        ].filter((contract)=>{
            if (seen.has(contract.contractId)) return false;
            seen.add(contract.contractId);
            return true;
        });
    }
    function getHarthmereCustomerOrdersV1(state, businessId) {
        var _state_businesses_businessId;
        const businessType2 = (_state_businesses_businessId = state.businesses[businessId]) === null || _state_businesses_businessId === void 0 ? void 0 : _state_businesses_businessId.typeId;
        var _state_customerContracts;
        const all = [
            ...(_state_customerContracts = state.customerContracts) !== null && _state_customerContracts !== void 0 ? _state_customerContracts : [],
            ...state.openContracts,
            ...state.activeContracts
        ];
        const seen = /* @__PURE__ */ new Set();
        return all.filter((contract)=>{
            if (seen.has(contract.contractId)) return false;
            seen.add(contract.contractId);
            return contract.issuerKind === "player" && contract.issuerId === state.actorId && (!contract.businessType || contract.businessType === businessType2 || contract.acceptedByBusinessId === businessId);
        });
    }
    function getHarthmereBusinessTodosV1(state, businessId) {
        const business2 = state.businesses[businessId];
        if (!business2) return [];
        const todos = [];
        if (business2.status !== "open") todos.push({
            id: "open_business",
            severity: "warning",
            label: "Open business",
            description: "This business is not open yet. Add property, license, and open it before customers can use it."
        });
        if (!getHarthmereBusinessBankAccountV1(state, businessId)) todos.push({
            id: "bank_account",
            severity: "info",
            label: "Create bank account",
            description: "Create a business bank account for safe deposits, withdrawals, logs, and permissions."
        });
        if (business2.balanceGold < business2.upkeepGoldPerDay + business2.wageGoldPerDay) todos.push({
            id: "funds_low",
            severity: "danger",
            label: "Funds low",
            description: "Business funds are below one day of upkeep and wages."
        });
        if (business2.sanitationRating < 45) todos.push({
            id: "sanitation_low",
            severity: "warning",
            label: "Sanitation risk",
            description: "Low sanitation can reduce satisfaction and trigger failures."
        });
        if (business2.safetyRating < 45) todos.push({
            id: "safety_low",
            severity: "warning",
            label: "Safety risk",
            description: "Low safety can reduce customers and create emergency work."
        });
        if (getHarthmereBusinessContractsV1(state, businessId).some((contract)=>contract.status === "active")) todos.push({
            id: "active_orders",
            severity: "info",
            label: "Fulfill active orders",
            description: "Accepted orders are waiting for delivery or service completion."
        });
        return todos;
    }
    function getHarthmereBusinessServiceActionsV1(typeId, mode) {
        var _HARTHMERE_BUSINESS_SERVICE_ACTIONS_V1_typeId;
        return ((_HARTHMERE_BUSINESS_SERVICE_ACTIONS_V1_typeId = HARTHMERE_BUSINESS_SERVICE_ACTIONS_V1[typeId]) !== null && _HARTHMERE_BUSINESS_SERVICE_ACTIONS_V1_typeId !== void 0 ? _HARTHMERE_BUSINESS_SERVICE_ACTIONS_V1_typeId : []).filter((action)=>action.audience === mode || action.audience === "both");
    }
    var FIELD_SERVICE_ACTION_IDS_V1 = /* @__PURE__ */ new Set([
        "inspect_biome",
        "request_redesign",
        "hire_guard",
        "request_repair",
        "request_ward",
        "book_expedition",
        "request_build",
        "request_care",
        "request_cleanup",
        "request_maintenance",
        "request_delivery",
        "book_room"
    ]);
    var FIELD_SERVICE_NEEDS_V1 = /* @__PURE__ */ new Set([
        "maintenance",
        "safety",
        "health",
        "sanitation",
        "logistics",
        "housing",
        "identity",
        "knowledge",
        "property_condition"
    ]);
    function requiresHarthmereFieldServiceQuestV1(action) {
        if (action.requiresWorldService === true) return true;
        if (FIELD_SERVICE_ACTION_IDS_V1.has(action.actionId)) return true;
        if (action.serviceNeed && FIELD_SERVICE_NEEDS_V1.has(action.serviceNeed)) return true;
        return false;
    }
    function getHarthmereBusinessFieldServiceSpecV1(business2, action, overrides = {}) {
        if (!requiresHarthmereFieldServiceQuestV1(action) && overrides.fieldService !== true) return void 0;
        var _overrides_serviceKind, _ref, _ref1;
        const serviceKind = String((_ref1 = (_ref = (_overrides_serviceKind = overrides.serviceKind) !== null && _overrides_serviceKind !== void 0 ? _overrides_serviceKind : action.fieldServiceKind) !== null && _ref !== void 0 ? _ref : action.serviceNeed) !== null && _ref1 !== void 0 ? _ref1 : action.actionId);
        var _overrides_targetId, _ref2, _ref3, _ref4;
        const targetId = String((_ref4 = (_ref3 = (_ref2 = (_overrides_targetId = overrides.targetId) !== null && _overrides_targetId !== void 0 ? _overrides_targetId : action.defaultTargetId) !== null && _ref2 !== void 0 ? _ref2 : business2.propertyId) !== null && _ref3 !== void 0 ? _ref3 : business2.townId) !== null && _ref4 !== void 0 ? _ref4 : business2.businessId);
        var _overrides_mapMarkerId, _overrides_questTitle, _overrides_todoText;
        return {
            required: true,
            serviceKind,
            targetId,
            mapMarkerId: String((_overrides_mapMarkerId = overrides.mapMarkerId) !== null && _overrides_mapMarkerId !== void 0 ? _overrides_mapMarkerId : targetId),
            questTitle: String((_overrides_questTitle = overrides.questTitle) !== null && _overrides_questTitle !== void 0 ? _overrides_questTitle : `${business2.name}: ${action.label}`),
            todoText: String((_overrides_todoText = overrides.todoText) !== null && _overrides_todoText !== void 0 ? _overrides_todoText : `${action.label} for ${business2.name}`)
        };
    }
    function getHarthmereBusinessInteractionPromptV1(state, context) {
        var _context_interactionKeyLabel;
        const keyLabel = (_context_interactionKeyLabel = context.interactionKeyLabel) !== null && _context_interactionKeyLabel !== void 0 ? _context_interactionKeyLabel : "E";
        if (!state || !context.insideBusiness || !context.nearbyBusinessId || !state.businesses[context.nearbyBusinessId]) {
            return {
                visible: false,
                label: "",
                helper: "",
                keyLabel
            };
        }
        const business2 = state.businesses[context.nearbyBusinessId];
        const mode = getHarthmereBusinessActorModeV1(state, business2.businessId);
        if (mode === "customer" && !canCustomerUseHarthmereBusinessV1(business2)) return {
            visible: false,
            label: "",
            helper: "",
            keyLabel
        };
        return {
            visible: true,
            businessId: business2.businessId,
            mode,
            keyLabel,
            label: `Press ${keyLabel} to ${mode === "owner" ? "manage" : "use"} ${business2.name}`,
            helper: mode === "owner" ? "Clients, orders, money, staff, licenses, and todos" : "Order services, check status, and browse inventory"
        };
    }
    function soonestContractLabel(contracts) {
        const active = contracts.filter((contract)=>contract.status === "active" || contract.status === "open").sort((a, b)=>a.deadlineAtMs - b.deadlineAtMs)[0];
        if (!active) return "No order deadline is pressing right now.";
        return `${active.title} is due ${new Date(active.deadlineAtMs).toLocaleDateString()}.`;
    }
    function requiredStockLabel(definition2) {
        const requiredItems = Array.from(new Set(definition2.offers.flatMap((offer)=>Object.keys(offer.requiredItems))));
        if (!requiredItems.length) return "No service stock is required yet.";
        return requiredItems.slice(0, 4).map(titleCaseBusinessText).join(", ");
    }
    function getHarthmereBusinessGrowthReportV1(state, businessId) {
        var _state_businessSystems_customerStats, _blockers_;
        const business2 = state.businesses[businessId];
        var _business2_typeId;
        const typeId = (_business2_typeId = business2 === null || business2 === void 0 ? void 0 : business2.typeId) !== null && _business2_typeId !== void 0 ? _business2_typeId : "general_trader";
        const definition2 = getHarthmereBusinessMiniGameDefinitionV1(typeId);
        const stats = normalizeHarthmereBusinessCustomerStatsV1((_state_businessSystems_customerStats = state.businessSystems.customerStats) === null || _state_businessSystems_customerStats === void 0 ? void 0 : _state_businessSystems_customerStats[businessId], businessId);
        const contracts = getHarthmereBusinessContractsV1(state, businessId);
        const activeOrders = contracts.filter((contract)=>contract.status === "active").length;
        const todos = getHarthmereBusinessTodosV1(state, businessId);
        const blockers = todos.filter((todo)=>todo.severity !== "info");
        var _definition2_scalePath_Math_min, _ref;
        const nextUpgrade = (_ref = (_definition2_scalePath_Math_min = definition2.scalePath[Math.min(stats.currentTier, definition2.scalePath.length - 1)]) !== null && _definition2_scalePath_Math_min !== void 0 ? _definition2_scalePath_Math_min : definition2.scalePath[definition2.scalePath.length - 1]) !== null && _ref !== void 0 ? _ref : "Keep improving service quality.";
        var _state_businessSystems_customerSessions;
        const session = Object.values((_state_businessSystems_customerSessions = state.businessSystems.customerSessions) !== null && _state_businessSystems_customerSessions !== void 0 ? _state_businessSystems_customerSessions : {}).find((candidate)=>candidate.businessId === businessId && candidate.status === "active");
        const activeWork = session ? `${session.queue.length - session.servedTicketIds.length - session.failedTicketIds.length} customers still need service.` : activeOrders > 0 ? `${activeOrders} accepted order${activeOrders === 1 ? "" : "s"} need work.` : "No active queue is blocking the floor.";
        var _session_failedTicketIds_length;
        const missed = stats.totalFailed + ((_session_failedTicketIds_length = session === null || session === void 0 ? void 0 : session.failedTicketIds.length) !== null && _session_failedTicketIds_length !== void 0 ? _session_failedTicketIds_length : 0);
        var _blockers__description, _ref1;
        const warning = (_ref1 = (_blockers__description = (_blockers_ = blockers[0]) === null || _blockers_ === void 0 ? void 0 : _blockers_.description) !== null && _blockers__description !== void 0 ? _blockers__description : definition2.challengeGrowth[0]) !== null && _ref1 !== void 0 ? _ref1 : "Watch the next customer bottleneck.";
        var _business2_balanceGold, _business2_upkeepGoldPerDay, _business2_rentGoldPerDay, _business2_wageGoldPerDay, _business2_completedContracts, _business2_customerSatisfaction, _business2_safetyRating, _business2_sanitationRating, _definition2_dailyReturnTriggers_, _definition2_challengeGrowth_, _definition2_empireReinforcement_;
        return {
            businessId,
            typeId,
            earnedToday: `${(_business2_balanceGold = business2 === null || business2 === void 0 ? void 0 : business2.balanceGold) !== null && _business2_balanceGold !== void 0 ? _business2_balanceGold : 0} gold available; ${stats.lifetimeGold} gold earned from customer service.`,
            costsToday: `${((_business2_upkeepGoldPerDay = business2 === null || business2 === void 0 ? void 0 : business2.upkeepGoldPerDay) !== null && _business2_upkeepGoldPerDay !== void 0 ? _business2_upkeepGoldPerDay : 0) + ((_business2_rentGoldPerDay = business2 === null || business2 === void 0 ? void 0 : business2.rentGoldPerDay) !== null && _business2_rentGoldPerDay !== void 0 ? _business2_rentGoldPerDay : 0) + ((_business2_wageGoldPerDay = business2 === null || business2 === void 0 ? void 0 : business2.wageGoldPerDay) !== null && _business2_wageGoldPerDay !== void 0 ? _business2_wageGoldPerDay : 0)} gold in daily upkeep, rent, and wages.`,
            completedToday: `${(_business2_completedContracts = business2 === null || business2 === void 0 ? void 0 : business2.completedContracts) !== null && _business2_completedContracts !== void 0 ? _business2_completedContracts : 0} contracts completed; ${stats.totalServed} customers served.`,
            failedOrDecayed: missed > 0 ? `${missed} missed customers or service failures need recovery.` : "No customer misses are recorded.",
            expiringSoon: soonestContractLabel(contracts),
            bottleneck: warning,
            nextUpgrade,
            activeWork,
            inventoryFocus: requiredStockLabel(definition2),
            reputationFocus: `${(_business2_customerSatisfaction = business2 === null || business2 === void 0 ? void 0 : business2.customerSatisfaction) !== null && _business2_customerSatisfaction !== void 0 ? _business2_customerSatisfaction : 0}/100 satisfaction, ${(_business2_safetyRating = business2 === null || business2 === void 0 ? void 0 : business2.safetyRating) !== null && _business2_safetyRating !== void 0 ? _business2_safetyRating : 0} safety, ${(_business2_sanitationRating = business2 === null || business2 === void 0 ? void 0 : business2.sanitationRating) !== null && _business2_sanitationRating !== void 0 ? _business2_sanitationRating : 0} sanitation.`,
            rewardLayers: [
                `Money: ${(_definition2_dailyReturnTriggers_ = definition2.dailyReturnTriggers[0]) !== null && _definition2_dailyReturnTriggers_ !== void 0 ? _definition2_dailyReturnTriggers_ : "Daily demand keeps revenue moving."}`,
                `Reputation: ${(_definition2_challengeGrowth_ = definition2.challengeGrowth[0]) !== null && _definition2_challengeGrowth_ !== void 0 ? _definition2_challengeGrowth_ : "Service quality changes trust."}`,
                `Capability: unlock ${nextUpgrade}.`,
                `Town impact: ${(_definition2_empireReinforcement_ = definition2.empireReinforcement[0]) !== null && _definition2_empireReinforcement_ !== void 0 ? _definition2_empireReinforcement_ : "This business supports the local economy."}`
            ]
        };
    }
    function getHarthmereOwnerDashboardV1(state, businessId) {
        const business2 = state.businesses[businessId];
        const money = getHarthmereBusinessMoneySummaryV1(state, businessId);
        const todos = getHarthmereBusinessTodosV1(state, businessId);
        const activeOrders = getHarthmereBusinessContractsV1(state, businessId).filter((contract)=>contract.status === "active").length;
        var _business2_name, _business2_completedContracts, _business2_customerSatisfaction, _business2_safetyRating, _business2_sanitationRating;
        return {
            title: `${(_business2_name = business2 === null || business2 === void 0 ? void 0 : business2.name) !== null && _business2_name !== void 0 ? _business2_name : "Business"} Dashboard`,
            metrics: [
                {
                    id: "balance",
                    label: "Cash",
                    value: `${money.balanceGold}`,
                    hint: `Bank ${money.bankBalanceGold} \xB7 Debt ${money.debtGold}`
                },
                {
                    id: "orders",
                    label: "Active Orders",
                    value: `${activeOrders}`,
                    hint: `${(_business2_completedContracts = business2 === null || business2 === void 0 ? void 0 : business2.completedContracts) !== null && _business2_completedContracts !== void 0 ? _business2_completedContracts : 0} completed`
                },
                {
                    id: "ratings",
                    label: "Ratings",
                    value: `${(_business2_customerSatisfaction = business2 === null || business2 === void 0 ? void 0 : business2.customerSatisfaction) !== null && _business2_customerSatisfaction !== void 0 ? _business2_customerSatisfaction : 0}/100`,
                    hint: `Safety ${(_business2_safetyRating = business2 === null || business2 === void 0 ? void 0 : business2.safetyRating) !== null && _business2_safetyRating !== void 0 ? _business2_safetyRating : 0} \xB7 Sanitation ${(_business2_sanitationRating = business2 === null || business2 === void 0 ? void 0 : business2.sanitationRating) !== null && _business2_sanitationRating !== void 0 ? _business2_sanitationRating : 0}`
                },
                {
                    id: "upkeep",
                    label: "Daily Costs",
                    value: `${money.dailyUpkeepGold + money.dailyRentGold + money.dailyWagesGold}`,
                    hint: "upkeep + rent + wages"
                }
            ],
            todos,
            criticalCount: todos.filter((todo)=>todo.severity === "danger").length
        };
    }
    function getHarthmereBusinessShopfrontV1(state, businessId, mode = "customer") {
        const business2 = state.businesses[businessId];
        if (!business2 || mode === "customer" && !canCustomerUseHarthmereBusinessV1(business2)) {
            return {
                businessId,
                inventory: [],
                acceptsCustomOrders: false,
                emptyLabel: "This business is not open to customers."
            };
        }
        const inventory2 = getHarthmereVisibleBusinessInventoryV1(state, businessId);
        return {
            businessId,
            inventory: inventory2,
            acceptsCustomOrders: mode === "customer" && canCustomerUseHarthmereBusinessV1(business2),
            emptyLabel: inventory2.length ? "" : "No public inventory is stocked yet."
        };
    }
    function getHarthmereContractBoardV1(state, businessId) {
        const byId = {};
        var _state_openContracts, _state_activeContracts, _state_customerContracts;
        for (const contract of [
            ...(_state_openContracts = state.openContracts) !== null && _state_openContracts !== void 0 ? _state_openContracts : [],
            ...(_state_activeContracts = state.activeContracts) !== null && _state_activeContracts !== void 0 ? _state_activeContracts : [],
            ...(_state_customerContracts = state.customerContracts) !== null && _state_customerContracts !== void 0 ? _state_customerContracts : []
        ])byId[contract.contractId] = contract;
        const all = Object.values(byId);
        return {
            open: all.filter((contract)=>{
                var _state_businesses_businessId;
                return contract.status === "open" && (!contract.businessType || contract.businessType === ((_state_businesses_businessId = state.businesses[businessId]) === null || _state_businesses_businessId === void 0 ? void 0 : _state_businesses_businessId.typeId));
            }),
            active: all.filter((contract)=>contract.status === "active" && contract.acceptedByBusinessId === businessId),
            fulfilled: all.filter((contract)=>contract.status === "fulfilled" && contract.acceptedByBusinessId === businessId),
            customer: getHarthmereCustomerOrdersV1(state, businessId)
        };
    }
    function getHarthmereBusinessFinancePanelV1(state, businessId) {
        const account = getHarthmereBusinessBankAccountV1(state, businessId);
        var _state_loans, _state_insurancePolicies, _account_audit;
        return {
            summary: getHarthmereBusinessMoneySummaryV1(state, businessId),
            account,
            loans: Object.values((_state_loans = state.loans) !== null && _state_loans !== void 0 ? _state_loans : {}).filter((loan)=>loan.businessId === businessId),
            insurancePolicies: Object.values((_state_insurancePolicies = state.insurancePolicies) !== null && _state_insurancePolicies !== void 0 ? _state_insurancePolicies : {}).filter((policy)=>policy.businessId === businessId),
            audit: (_account_audit = account === null || account === void 0 ? void 0 : account.audit) !== null && _account_audit !== void 0 ? _account_audit : []
        };
    }
    function getHarthmereBusinessStaffPanelV1(state, businessId) {
        var _state_employees;
        const employees = Object.values((_state_employees = state.employees) !== null && _state_employees !== void 0 ? _state_employees : {}).filter((employee)=>employee.businessId === businessId);
        var _state_businessSystems_employeeCandidates;
        const candidates = Object.values((_state_businessSystems_employeeCandidates = state.businessSystems.employeeCandidates) !== null && _state_businessSystems_employeeCandidates !== void 0 ? _state_businessSystems_employeeCandidates : {}).filter((candidate)=>candidate.businessId === businessId && candidate.status !== "hired" && candidate.status !== "withdrawn").sort((a, b)=>a.generatedAtMs - b.generatedAtMs);
        var _state_businessSystems_employeeTaskRuns;
        const recentTaskRuns = Object.values((_state_businessSystems_employeeTaskRuns = state.businessSystems.employeeTaskRuns) !== null && _state_businessSystems_employeeTaskRuns !== void 0 ? _state_businessSystems_employeeTaskRuns : {}).filter((run)=>run.businessId === businessId).sort((a, b)=>b.createdAtMs - a.createdAtMs).slice(0, 6);
        return {
            employees,
            candidates,
            recentTaskRuns,
            canHire: getHarthmereBusinessActorModeV1(state, businessId) === "owner",
            payrollDueGold: employees.reduce((sum, employee)=>sum + employee.wageGoldPerDay, 0),
            moraleWarnings: employees.filter((employee)=>employee.morale < 35)
        };
    }
    function getHarthmereBusinessCompliancePanelV1(state, businessId) {
        const business2 = state.businesses[businessId];
        const type = business2 ? state.businessTypes[business2.typeId] : void 0;
        const warnings = [];
        if (business2 && type && business2.licenseLevel < type.minimumLicenseLevel) warnings.push("license_level_below_business_minimum");
        if ((business2 === null || business2 === void 0 ? void 0 : business2.sanitationRating) !== void 0 && business2.sanitationRating < 50) warnings.push("sanitation_inspection_risk");
        if ((business2 === null || business2 === void 0 ? void 0 : business2.safetyRating) !== void 0 && business2.safetyRating < 50) warnings.push("safety_inspection_risk");
        var _business2_licenseClass, _business2_licenseLevel, _business2_sanitationRating, _business2_safetyRating;
        return {
            licenseClass: (_business2_licenseClass = business2 === null || business2 === void 0 ? void 0 : business2.licenseClass) !== null && _business2_licenseClass !== void 0 ? _business2_licenseClass : "unknown",
            licenseLevel: (_business2_licenseLevel = business2 === null || business2 === void 0 ? void 0 : business2.licenseLevel) !== null && _business2_licenseLevel !== void 0 ? _business2_licenseLevel : 0,
            requiredLicense: type === null || type === void 0 ? void 0 : type.requiredLicense,
            minimumLicenseLevel: type === null || type === void 0 ? void 0 : type.minimumLicenseLevel,
            sanitationRating: (_business2_sanitationRating = business2 === null || business2 === void 0 ? void 0 : business2.sanitationRating) !== null && _business2_sanitationRating !== void 0 ? _business2_sanitationRating : 0,
            safetyRating: (_business2_safetyRating = business2 === null || business2 === void 0 ? void 0 : business2.safetyRating) !== null && _business2_safetyRating !== void 0 ? _business2_safetyRating : 0,
            warnings
        };
    }
    function recordsForBusiness(source, businessId) {
        return Object.values(source !== null && source !== void 0 ? source : {}).filter((entry)=>entry.businessId === businessId || entry.courierBusinessId === businessId || entry.ownerBusinessId === businessId);
    }
    function getHarthmereBusinessOperationScreenV1(state, businessId) {
        var _state_businessTypes_typeId;
        const business2 = state.businesses[businessId];
        var _business2_typeId;
        const typeId = (_business2_typeId = business2 === null || business2 === void 0 ? void 0 : business2.typeId) !== null && _business2_typeId !== void 0 ? _business2_typeId : "general_trader";
        var _state_businessSystems;
        const systems = (_state_businessSystems = state.businessSystems) !== null && _state_businessSystems !== void 0 ? _state_businessSystems : {};
        var _state_businessTypes_typeId_displayName;
        return {
            businessId,
            typeId,
            title: (_state_businessTypes_typeId_displayName = (_state_businessTypes_typeId = state.businessTypes[typeId]) === null || _state_businessTypes_typeId === void 0 ? void 0 : _state_businessTypes_typeId.displayName) !== null && _state_businessTypes_typeId_displayName !== void 0 ? _state_businessTypes_typeId_displayName : typeId,
            ownerActions: getHarthmereBusinessServiceActionsV1(typeId, "owner"),
            customerActions: canCustomerUseHarthmereBusinessV1(business2) ? getHarthmereBusinessServiceActionsV1(typeId, "customer") : [],
            systemRecords: {
                anchors: recordsForBusiness(systems.biomeAnchors, businessId),
                threats: recordsForBusiness(systems.threats, businessId),
                portals: recordsForBusiness(systems.portalEndpoints, businessId),
                teleports: recordsForBusiness(systems.teleportPads, businessId),
                crops: recordsForBusiness(systems.cropNodes, businessId),
                animals: recordsForBusiness(systems.animalPopulations, businessId),
                contamination: recordsForBusiness(systems.contaminationSites, businessId),
                patients: recordsForBusiness(systems.patients, businessId),
                durableItems: recordsForBusiness(systems.durableItems, businessId),
                routes: recordsForBusiness(systems.explorationRoutes, businessId),
                deliveries: recordsForBusiness(systems.deliveries, businessId),
                hospitality: recordsForBusiness(systems.hospitality, businessId),
                serviceQuests: recordsForBusiness(systems.serviceQuests, businessId)
            }
        };
    }
    function getHarthmereBusinessCustomerMiniGameV1(state, businessId) {
        var _state_businessSystems_customerStats;
        const business2 = state.businesses[businessId];
        var _business2_typeId;
        const typeId = (_business2_typeId = business2 === null || business2 === void 0 ? void 0 : business2.typeId) !== null && _business2_typeId !== void 0 ? _business2_typeId : "general_trader";
        const definition2 = getHarthmereBusinessMiniGameDefinitionV1(typeId);
        var _state_businessSystems_customerSessions;
        const sessions = Object.values((_state_businessSystems_customerSessions = state.businessSystems.customerSessions) !== null && _state_businessSystems_customerSessions !== void 0 ? _state_businessSystems_customerSessions : {});
        const activeSession = sessions.find((session)=>session.businessId === businessId && session.status === "active");
        const currentTicket = activeHarthmereBusinessCustomerTicketV1(activeSession);
        const currentNpc = findHarthmereBusinessCustomerNpcV1(currentTicket === null || currentTicket === void 0 ? void 0 : currentTicket.npcId);
        const stats = normalizeHarthmereBusinessCustomerStatsV1((_state_businessSystems_customerStats = state.businessSystems.customerStats) === null || _state_businessSystems_customerStats === void 0 ? void 0 : _state_businessSystems_customerStats[businessId], businessId);
        return {
            businessId,
            typeId,
            definition: definition2,
            customerPool: HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1.filter((npc)=>npc.businessPreferences.includes(typeId)),
            stats,
            activeSession,
            currentTicket,
            currentNpc,
            offers: definition2.offers,
            progressPath: definition2.scalePath,
            dailyReturnTriggers: definition2.dailyReturnTriggers,
            challengeGrowth: definition2.challengeGrowth,
            empireReinforcement: definition2.empireReinforcement,
            gapsClosed: definition2.implementationGapsClosed
        };
    }
    function getHarthmereBusinessEmpirePanelV1(state, businessId) {
        var _state_businessSystems_customerStats;
        const business2 = state.businesses[businessId];
        var _business2_typeId;
        const typeId = (_business2_typeId = business2 === null || business2 === void 0 ? void 0 : business2.typeId) !== null && _business2_typeId !== void 0 ? _business2_typeId : "general_trader";
        var _state_businessSystems_empireBranches;
        const branches = Object.values((_state_businessSystems_empireBranches = state.businessSystems.empireBranches) !== null && _state_businessSystems_empireBranches !== void 0 ? _state_businessSystems_empireBranches : {}).filter((branch)=>branch.parentBusinessId === businessId);
        var _state_businessSystems_branchDashboards;
        const dashboards = Object.values((_state_businessSystems_branchDashboards = state.businessSystems.branchDashboards) !== null && _state_businessSystems_branchDashboards !== void 0 ? _state_businessSystems_branchDashboards : {}).filter((dashboard)=>dashboard.parentBusinessId === businessId);
        var _state_businessSystems_automationAssignments;
        const automations = Object.values((_state_businessSystems_automationAssignments = state.businessSystems.automationAssignments) !== null && _state_businessSystems_automationAssignments !== void 0 ? _state_businessSystems_automationAssignments : {}).filter((automation)=>automation.businessId === businessId);
        var _state_businessSystems_outpostBuildings;
        const outpostBuildings = Object.values((_state_businessSystems_outpostBuildings = state.businessSystems.outpostBuildings) !== null && _state_businessSystems_outpostBuildings !== void 0 ? _state_businessSystems_outpostBuildings : {}).filter((building)=>building.businessType === typeId);
        const stats = normalizeHarthmereBusinessCustomerStatsV1((_state_businessSystems_customerStats = state.businessSystems.customerStats) === null || _state_businessSystems_customerStats === void 0 ? void 0 : _state_businessSystems_customerStats[businessId], businessId);
        const branchOpenCostGold = 600 + Math.max(3, stats.currentTier) * 150;
        const warnings = [];
        if (stats.currentTier < 3 && stats.totalServed < 50) warnings.push("Serve more customers to unlock branches.");
        if (!outpostBuildings.length) warnings.push("No backend-generated outpost building is available for this business type.");
        if (business2 && business2.balanceGold < branchOpenCostGold) warnings.push("Branch opening needs stronger business funds.");
        return {
            businessId,
            branches,
            dashboards,
            automations,
            outpostBuildings,
            dailyRevenueGold: branches.reduce((sum, branch)=>sum + branch.dailyRevenueGold, 0),
            dailyUpkeepGold: branches.reduce((sum, branch)=>sum + branch.dailyUpkeepGold, 0) + automations.reduce((sum, automation)=>sum + automation.dailyUpkeepGold, 0),
            lifetimeProfitGold: branches.reduce((sum, branch)=>sum + branch.lifetimeProfitGold, 0),
            openBranchEligible: Boolean((business2 === null || business2 === void 0 ? void 0 : business2.status) === "open" && outpostBuildings.length && stats.currentTier >= 3 && business2.balanceGold >= branchOpenCostGold),
            warnings
        };
    }
    function getHarthmereTownHallPanelV1(state) {
        var _state_towns, _state_openContracts, _state_businesses;
        return {
            towns: Object.values((_state_towns = state.towns) !== null && _state_towns !== void 0 ? _state_towns : {}),
            publicContracts: ((_state_openContracts = state.openContracts) !== null && _state_openContracts !== void 0 ? _state_openContracts : []).filter((contract)=>contract.issuerKind === "town" || Boolean(contract.townId)),
            townBusinesses: Object.values((_state_businesses = state.businesses) !== null && _state_businesses !== void 0 ? _state_businesses : {}).filter((business2)=>business2.ownerKind === "town")
        };
    }
    function getHarthmereMarketplacePanelV1(state) {
        var _state_regions;
        const firstRegion = Object.values((_state_regions = state.regions) !== null && _state_regions !== void 0 ? _state_regions : {})[0];
        var _state_marketOrders, _firstRegion_priceIndex, _state_balanceWarnings;
        return {
            openOrders: Object.values((_state_marketOrders = state.marketOrders) !== null && _state_marketOrders !== void 0 ? _state_marketOrders : {}).filter((order)=>order.status === "open"),
            regionalPrices: (_firstRegion_priceIndex = firstRegion === null || firstRegion === void 0 ? void 0 : firstRegion.priceIndex) !== null && _firstRegion_priceIndex !== void 0 ? _firstRegion_priceIndex : {},
            marketWarnings: (_state_balanceWarnings = state.balanceWarnings) !== null && _state_balanceWarnings !== void 0 ? _state_balanceWarnings : []
        };
    }
    function getHarthmereGuildBusinessPanelV1(state, guildId) {
        var _state_businesses;
        const guildBusinesses = Object.values((_state_businesses = state.businesses) !== null && _state_businesses !== void 0 ? _state_businesses : {}).filter((business2)=>business2.ownerKind === "guild" && (!guildId || business2.ownerId === guildId));
        const guildBusinessIds = new Set(guildBusinesses.map((business2)=>business2.businessId));
        const permissions = {};
        for (const business2 of guildBusinesses){
            var _state_businessSystems, _state_businessSystems_permissions, _state_businessSystems_permissions_business2_businessId;
            var _state_businessSystems_permissions_business2_businessId_state_actorId;
            permissions[business2.businessId] = ((_state_businessSystems_permissions_business2_businessId_state_actorId = (_state_businessSystems = state.businessSystems) === null || _state_businessSystems === void 0 ? void 0 : (_state_businessSystems_permissions = _state_businessSystems.permissions) === null || _state_businessSystems_permissions === void 0 ? void 0 : (_state_businessSystems_permissions_business2_businessId = _state_businessSystems_permissions[business2.businessId]) === null || _state_businessSystems_permissions_business2_businessId === void 0 ? void 0 : _state_businessSystems_permissions_business2_businessId[state.actorId]) !== null && _state_businessSystems_permissions_business2_businessId_state_actorId !== void 0 ? _state_businessSystems_permissions_business2_businessId_state_actorId : []).slice();
        }
        var _state_openContracts, _state_activeContracts, _contract_acceptedByBusinessId;
        return {
            guildBusinesses,
            guildContracts: [
                ...(_state_openContracts = state.openContracts) !== null && _state_openContracts !== void 0 ? _state_openContracts : [],
                ...(_state_activeContracts = state.activeContracts) !== null && _state_activeContracts !== void 0 ? _state_activeContracts : []
            ].filter((contract)=>guildBusinessIds.has((_contract_acceptedByBusinessId = contract.acceptedByBusinessId) !== null && _contract_acceptedByBusinessId !== void 0 ? _contract_acceptedByBusinessId : "") || contract.issuerKind === "guild"),
            permissions
        };
    }
    function getHarthmereBusinessServiceQuestsV1(state, businessId) {
        var _state_businessSystems;
        var _state_businessSystems_serviceQuests;
        return Object.values((_state_businessSystems_serviceQuests = (_state_businessSystems = state.businessSystems) === null || _state_businessSystems === void 0 ? void 0 : _state_businessSystems.serviceQuests) !== null && _state_businessSystems_serviceQuests !== void 0 ? _state_businessSystems_serviceQuests : {}).filter((quest)=>!businessId || quest.businessId === businessId);
    }
    function serviceContractPayload(state, business2, action, overrides) {
        var _overrides_rewardGold, _ref;
        const rewardGold = Number((_ref = (_overrides_rewardGold = overrides.rewardGold) !== null && _overrides_rewardGold !== void 0 ? _overrides_rewardGold : action.rewardGold) !== null && _ref !== void 0 ? _ref : 75);
        var _overrides_deadlineAtMs, _action_serviceNeed, _overrides_requirements;
        return {
            ownerKind: "player",
            ownerId: state.actorId,
            businessType: business2.typeId,
            title: `${business2.name}: ${action.label}`,
            rewardGold,
            townId: business2.townId,
            regionId: business2.regionId,
            deadlineAtMs: Number((_overrides_deadlineAtMs = overrides.deadlineAtMs) !== null && _overrides_deadlineAtMs !== void 0 ? _overrides_deadlineAtMs : Date.now() + 7 * 24 * 60 * 60 * 1e3),
            requirements: (_overrides_requirements = overrides.requirements) !== null && _overrides_requirements !== void 0 ? _overrides_requirements : [
                {
                    serviceNeed: (_action_serviceNeed = action.serviceNeed) !== null && _action_serviceNeed !== void 0 ? _action_serviceNeed : "logistics",
                    serviceUnits: 1
                }
            ],
            fieldService: getHarthmereBusinessFieldServiceSpecV1(business2, action, overrides)
        };
    }
    function createHarthmereBusinessInterfaceAdapterV1(options) {
        let current = options.state;
        const setCurrent = (next)=>{
            var _options_setState;
            current = next;
            (_options_setState = options.setState) === null || _options_setState === void 0 ? void 0 : _options_setState.call(options, next);
        };
        const refresh = async ()=>{
            var _options_refresh;
            const next = await ((_options_refresh = options.refresh) === null || _options_refresh === void 0 ? void 0 : _options_refresh.call(options));
            if (next) setCurrent(next);
        };
        const submit = async (operation, payload)=>{
            var _options_submit;
            const response = await ((_options_submit = options.submit) === null || _options_submit === void 0 ? void 0 : _options_submit.call(options, operation, payload));
            if (response === null || response === void 0 ? void 0 : response.economyState) setCurrent(normalizeHarthmereBusinessEconomySnapshotV1(response.economyState));
            await refresh();
        };
        const requireState = ()=>{
            if (!current) throw new Error("business_interface_state_not_hydrated");
            return current;
        };
        return {
            isHydrated: ()=>options.hydrated !== false && Boolean(current),
            getState: ()=>current,
            refresh,
            isAvailable: (nearbyBusinessId)=>isHarthmereBusinessInterfaceAvailableV1(current, nearbyBusinessId),
            getMode: (businessId)=>getHarthmereBusinessActorModeV1(requireState(), businessId),
            getBusiness: (businessId)=>{
                return current === null || current === void 0 ? void 0 : current.businesses[businessId];
            },
            getBusinessType: (businessId)=>{
                const state = requireState();
                const business2 = state.businesses[businessId];
                return business2 ? state.businessTypes[business2.typeId] : void 0;
            },
            getInventory: (businessId)=>getHarthmereVisibleBusinessInventoryV1(requireState(), businessId),
            getMoneySummary: (businessId)=>getHarthmereBusinessMoneySummaryV1(requireState(), businessId),
            getEmployees: (businessId)=>Object.values(requireState().employees).filter((employee)=>employee.businessId === businessId),
            getContracts: (businessId)=>getHarthmereBusinessContractsV1(requireState(), businessId),
            getCustomerOrders: (businessId)=>getHarthmereCustomerOrdersV1(requireState(), businessId),
            getTodos: (businessId)=>getHarthmereBusinessTodosV1(requireState(), businessId),
            getServiceActions: (businessId, mode)=>{
                const state = requireState();
                const business2 = state.businesses[businessId];
                if (!business2) return [];
                const actorMode = mode !== null && mode !== void 0 ? mode : getHarthmereBusinessActorModeV1(state, businessId);
                if (actorMode === "customer" && !canCustomerUseHarthmereBusinessV1(business2)) return [];
                return getHarthmereBusinessServiceActionsV1(business2.typeId, actorMode);
            },
            getInteractionPrompt: (context)=>getHarthmereBusinessInteractionPromptV1(requireState(), context),
            getOwnerDashboard: (businessId)=>getHarthmereOwnerDashboardV1(requireState(), businessId),
            getGrowthReport: (businessId)=>getHarthmereBusinessGrowthReportV1(requireState(), businessId),
            getShopfront: (businessId)=>{
                const state = requireState();
                return getHarthmereBusinessShopfrontV1(state, businessId, getHarthmereBusinessActorModeV1(state, businessId));
            },
            getContractBoard: (businessId)=>getHarthmereContractBoardV1(requireState(), businessId),
            getFinancePanel: (businessId)=>getHarthmereBusinessFinancePanelV1(requireState(), businessId),
            getStaffPanel: (businessId)=>getHarthmereBusinessStaffPanelV1(requireState(), businessId),
            getCompliancePanel: (businessId)=>getHarthmereBusinessCompliancePanelV1(requireState(), businessId),
            getOperationScreen: (businessId)=>getHarthmereBusinessOperationScreenV1(requireState(), businessId),
            getCustomerMiniGame: (businessId)=>getHarthmereBusinessCustomerMiniGameV1(requireState(), businessId),
            getEmpirePanel: (businessId)=>getHarthmereBusinessEmpirePanelV1(requireState(), businessId),
            getTownHallPanel: ()=>getHarthmereTownHallPanelV1(requireState()),
            getMarketplacePanel: ()=>getHarthmereMarketplacePanelV1(requireState()),
            getGuildBusinessPanel: (guildId)=>getHarthmereGuildBusinessPanelV1(requireState(), guildId),
            getServiceQuests: (businessId)=>getHarthmereBusinessServiceQuestsV1(requireState(), businessId),
            submitOperation: submit,
            createBankAccount: (businessId)=>submit("create_business_bank_account", {
                    businessId
                }),
            transferPersonalToBusinessBank: (businessId, amountGold)=>submit("transfer_personal_to_business_bank", {
                    businessId,
                    amountGold
                }),
            transferBusinessToPersonalBank: (businessId, amountGold)=>submit("transfer_business_to_personal_bank", {
                    businessId,
                    amountGold
                }),
            depositInventory: (businessId, itemId, count)=>submit("deposit_business_inventory", {
                    businessId,
                    itemId,
                    count
                }),
            withdrawInventory: (businessId, itemId, count)=>submit("withdraw_business_inventory", {
                    businessId,
                    itemId,
                    count
                }),
            setPrices: (businessId, priceModifiers)=>submit("set_business_prices", {
                    businessId,
                    priceModifiers
                }),
            openBusiness: (businessId, propertyId, townId)=>submit("open_business", {
                    businessId,
                    propertyId,
                    townId
                }),
            hireWorker: (businessId, role, wageGoldPerDay, skill = 1)=>submit("hire_worker", {
                    businessId,
                    role,
                    wageGoldPerDay,
                    skill
                }),
            assignWorker: (businessId, employeeId, assignedTask)=>submit("assign_worker", {
                    businessId,
                    employeeId,
                    assignedTask
                }),
            fireWorker: (businessId, employeeId)=>submit("fire_worker", {
                    businessId,
                    employeeId
                }),
            trainWorker: (businessId, employeeId)=>submit("train_worker", {
                    businessId,
                    employeeId
                }),
            promoteWorker: (businessId, employeeId, assignedTask)=>submit("promote_business_employee", {
                    businessId,
                    employeeId,
                    ...assignedTask ? {
                        assignedTask
                    } : {}
                }),
            payPayroll: (businessId)=>submit("pay_payroll", {
                    businessId
                }),
            refreshEmployeeCandidates: (businessId, count = 3)=>submit("refresh_business_employee_candidates", {
                    businessId,
                    count
                }),
            interviewEmployeeCandidate: (businessId, candidateId, interviewStyle = "friendly")=>submit("interview_business_employee_candidate", {
                    businessId,
                    candidateId,
                    interviewStyle
                }),
            negotiateEmployeeCandidate: (businessId, candidateId, wageGoldPerDay)=>submit("negotiate_business_employee_candidate", {
                    businessId,
                    candidateId,
                    wageGoldPerDay
                }),
            hireEmployeeCandidate: (businessId, candidateId)=>submit("hire_business_employee_candidate", {
                    businessId,
                    candidateId
                }),
            runEmployeeTask: (businessId, employeeId, assignedTask, offerId)=>submit("run_business_employee_task", {
                    businessId,
                    employeeId,
                    ...assignedTask ? {
                        assignedTask
                    } : {},
                    ...offerId ? {
                        offerId
                    } : {}
                }),
            runEmployeeMoraleTick: (businessId, days = 1)=>submit("run_business_employee_morale_tick", {
                    businessId,
                    days
                }),
            acceptContract: (businessId, contractId)=>submit("accept_contract", {
                    businessId,
                    contractId,
                    createQuestOnAccept: true
                }),
            fulfillContract: (businessId, contractId)=>submit("fulfill_contract", {
                    businessId,
                    contractId
                }),
            grantPermission: (businessId, targetActorId, permissions)=>submit("grant_business_permission", {
                    businessId,
                    targetActorId,
                    permissions
                }),
            purchaseShopItem: async (businessId, itemId, count)=>{
                const business2 = requireState().businesses[businessId];
                if (!business2) throw new Error("business_not_found");
                if (!canCustomerUseHarthmereBusinessV1(business2)) throw new Error("business_not_open");
                await submit("record_customer_sale", {
                    businessId,
                    itemId,
                    count
                });
            },
            runServiceAction: async (businessId, actionId, overrides = {})=>{
                const state = requireState();
                const business2 = state.businesses[businessId];
                if (!business2) throw new Error("business_not_found");
                const action = getHarthmereBusinessServiceActionsV1(business2.typeId, "owner").find((entry)=>entry.actionId === actionId);
                if (!action) throw new Error(`business_action_not_available:${actionId}`);
                var _action_defaultPayload;
                await submit(action.operation, {
                    businessId,
                    ...(_action_defaultPayload = action.defaultPayload) !== null && _action_defaultPayload !== void 0 ? _action_defaultPayload : {},
                    ...overrides
                });
            },
            requestCustomerService: async (businessId, actionId, overrides = {})=>{
                const state = requireState();
                const business2 = state.businesses[businessId];
                if (!business2) throw new Error("business_not_found");
                if (!canCustomerUseHarthmereBusinessV1(business2)) throw new Error("business_not_open");
                const action = getHarthmereBusinessServiceActionsV1(business2.typeId, "customer").find((entry)=>entry.actionId === actionId);
                if (!action) throw new Error(`business_customer_action_not_available:${actionId}`);
                if (action.operation === "create_contract") {
                    await submit("create_contract", serviceContractPayload(state, business2, action, overrides));
                } else {
                    var _action_defaultPayload;
                    await submit(action.operation, {
                        businessId,
                        ...(_action_defaultPayload = action.defaultPayload) !== null && _action_defaultPayload !== void 0 ? _action_defaultPayload : {},
                        ...overrides
                    });
                }
            },
            startCustomerSession: (businessId, count)=>submit("start_business_customer_session", {
                    businessId,
                    ...count ? {
                        count
                    } : {}
                }),
            serveCustomer: (businessId, offerId, sessionId, ticketId)=>submit("serve_business_customer", {
                    businessId,
                    offerId,
                    ...sessionId ? {
                        sessionId
                    } : {},
                    ...ticketId ? {
                        ticketId
                    } : {}
                }),
            openBranch: (businessId, outpostId)=>submit("open_business_branch", {
                    businessId,
                    ...outpostId ? {
                        outpostId
                    } : {}
                }),
            assignAutomation: (businessId, role, branchId, employeeId)=>submit("assign_business_automation", {
                    businessId,
                    role,
                    ...branchId ? {
                        branchId
                    } : {},
                    ...employeeId ? {
                        employeeId
                    } : {}
                }),
            assignBranchManager: (businessId, branchId, employeeId)=>submit("assign_business_branch_manager", {
                    businessId,
                    branchId,
                    employeeId
                }),
            routeBranchStock: (businessId, branchId, itemId, count)=>submit("route_business_branch_stock", {
                    businessId,
                    branchId,
                    itemId,
                    count
                }),
            scheduleBranchStaff: (businessId, branchId, employeeIds)=>submit("schedule_business_branch_staff", {
                    businessId,
                    branchId,
                    employeeIds
                }),
            closeBranch: (businessId, branchId)=>submit("close_business_branch", {
                    businessId,
                    branchId
                }),
            settleEmpireDay: (businessId, days)=>submit("run_business_empire_day", {
                    businessId,
                    ...days ? {
                        days
                    } : {}
                })
        };
    }
    // src/client/components/harthmere_business/HarthmereBusinessInterfacePanel.tsx
    var OWNER_TABS = [
        "dashboard",
        "customers",
        "orders",
        "shopfront",
        "finance",
        "staff",
        "empire",
        "licenses",
        "operations",
        "town",
        "market",
        "guild"
    ];
    var CUSTOMER_TABS = [
        "overview",
        "services",
        "shopfront",
        "status",
        "market"
    ];
    var TAB_LABELS = {
        dashboard: "Dashboard",
        customers: "Customers",
        orders: "Orders",
        shopfront: "Shopfront",
        finance: "Finance",
        staff: "Staff",
        empire: "Empire",
        licenses: "Licenses",
        operations: "Operations",
        town: "Town",
        market: "Market",
        guild: "Guild",
        overview: "Overview",
        services: "Services",
        status: "Status"
    };
    function displayLabel(value) {
        if (!value) return "";
        return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/[:./]+/g, " ").replace(/\s+/g, " ").trim().replace(/\b\w/g, (char)=>char.toUpperCase());
    }
    function ticketPatienceRemaining(ticket, nowMs) {
        if (!ticket) return 0;
        const elapsed = Math.max(0, Math.floor((nowMs - ticket.arrivedAtMs) / 1e3));
        return Math.max(0, Math.min(ticket.patienceRemaining, ticket.patience - elapsed));
    }
    function isTypingInInput() {
        if (typeof document === "undefined") return false;
        const active = document.activeElement;
        if (!active) return false;
        const tag = active.tagName.toLowerCase();
        return tag === "input" || tag === "textarea" || active.isContentEditable;
    }
    function chunk(items, size) {
        const rows = [];
        for(let i = 0; i < items.length; i += size)rows.push(items.slice(i, i + size));
        return rows.length ? rows : [
            []
        ];
    }
    var HarthmereBusinessInterfacePanel = ({ adapter: adapter2 , nearbyBusinessId , context , onClose , compact =false , initialTab  })=>{
        const pointerLockManager = usePointerLockManager();
        const shouldReturnPointerLock = React3.useRef(false);
        var _ref;
        const activeBusinessId = (_ref = nearbyBusinessId !== null && nearbyBusinessId !== void 0 ? nearbyBusinessId : context === null || context === void 0 ? void 0 : context.nearbyBusinessId) !== null && _ref !== void 0 ? _ref : null;
        const available = adapter2.isHydrated() && adapter2.isAvailable(activeBusinessId);
        const business2 = activeBusinessId ? adapter2.getBusiness(activeBusinessId) : void 0;
        const mode = business2 && activeBusinessId ? adapter2.getMode(activeBusinessId) : "customer";
        const tabs = mode === "owner" ? OWNER_TABS : CUSTOMER_TABS;
        const [activeTab, setActiveTab] = React3.useState(initialTab && tabs.includes(initialTab) ? initialTab : tabs[0]);
        React3.useEffect(()=>installBiomesUITheme(), []);
        React3.useEffect(()=>{
            if (!available || compact) return;
            shouldReturnPointerLock.current = pointerLockManager.isLocked();
            pointerLockManager.unlock();
            return ()=>{
                if (shouldReturnPointerLock.current) pointerLockManager.focusAndLock();
                shouldReturnPointerLock.current = false;
            };
        }, [
            available,
            compact,
            pointerLockManager
        ]);
        React3.useEffect(()=>{
            if (!tabs.includes(activeTab)) setActiveTab(tabs[0]);
        }, [
            activeTab,
            tabs.join("|")
        ]);
        React3.useEffect(()=>{
            if (!available) return;
            function onKeyDown(event) {
                if (isTypingInInput()) return;
                if (event.key === "Escape") {
                    event.preventDefault();
                    onClose === null || onClose === void 0 ? void 0 : onClose();
                    return;
                }
                if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                event.preventDefault();
                const index = tabs.indexOf(activeTab);
                const dir = event.key === "ArrowRight" ? 1 : -1;
                setActiveTab(tabs[(index + dir + tabs.length) % tabs.length]);
            }
            document.addEventListener("keydown", onKeyDown);
            return ()=>document.removeEventListener("keydown", onKeyDown);
        }, [
            activeTab,
            available,
            onClose,
            tabs.join("|")
        ]);
        if (!activeBusinessId || !available || !business2) return null;
        const type = adapter2.getBusinessType(activeBusinessId);
        var _type_displayName;
        return /*#__PURE__*/ React4.createElement("div", {
            role: "dialog",
            "aria-label": `${business2.name} business interface`,
            "data-harthmere-business-interface": "true",
            "data-business-interface-scope": "inside-business-only",
            "data-pointer-lock-policy": "unlock-while-open",
            "data-mouse-policy": "show-while-open",
            "data-business-id": activeBusinessId,
            "data-business-mode": mode,
            className: "biomes-ui-panel",
            style: {
                position: compact ? "relative" : "fixed",
                inset: compact ? void 0 : "max(10px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) max(10px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left))",
                zIndex: compact ? void 0 : 1250,
                maxWidth: compact ? void 0 : 1180,
                width: compact ? "100%" : "calc(100vw - 20px)",
                maxHeight: compact ? void 0 : "calc(100vh - 20px)",
                boxSizing: "border-box",
                margin: compact ? void 0 : "auto",
                overflow: "auto",
                padding: compact ? 12 : "16px 18px"
            }
        }, /*#__PURE__*/ React4.createElement("header", {
            style: {
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto",
                gap: 12,
                alignItems: "start",
                marginBottom: 12
            }
        }, /*#__PURE__*/ React4.createElement("div", null, /*#__PURE__*/ React4.createElement("h2", {
            style: panelTitleStyle
        }, business2.name), /*#__PURE__*/ React4.createElement("p", {
            style: mutedTextStyle
        }, (_type_displayName = type === null || type === void 0 ? void 0 : type.displayName) !== null && _type_displayName !== void 0 ? _type_displayName : displayLabel(business2.typeId), " \xB7 ", mode === "owner" ? "Owner Management" : "Customer Services", " \xB7 ", displayLabel(business2.status))), /*#__PURE__*/ React4.createElement("button", {
            type: "button",
            className: "biomes-ui-tab",
            onClick: onClose,
            "aria-label": "Close business interface"
        }, "Close")), /*#__PURE__*/ React4.createElement("nav", {
            "aria-label": "Business interface sections",
            style: {
                display: "flex",
                flexWrap: "wrap",
                gap: 4,
                marginBottom: 12
            }
        }, tabs.map((tab)=>/*#__PURE__*/ React4.createElement("button", {
                key: tab,
                type: "button",
                className: "biomes-ui-tab",
                "aria-selected": activeTab === tab,
                onClick: ()=>setActiveTab(tab)
            }, TAB_LABELS[tab]))), activeTab === "dashboard" && /*#__PURE__*/ React4.createElement(OwnerDashboardPane, {
            adapter: adapter2,
            businessId: activeBusinessId
        }), activeTab === "customers" && /*#__PURE__*/ React4.createElement(CustomerMiniGamePane, {
            adapter: adapter2,
            businessId: activeBusinessId
        }), activeTab === "overview" && /*#__PURE__*/ React4.createElement(CustomerOverviewPane, {
            adapter: adapter2,
            businessId: activeBusinessId
        }), activeTab === "orders" && /*#__PURE__*/ React4.createElement(ContractBoardPane, {
            adapter: adapter2,
            businessId: activeBusinessId
        }), activeTab === "shopfront" && /*#__PURE__*/ React4.createElement(ShopfrontPane, {
            adapter: adapter2,
            businessId: activeBusinessId,
            mode: mode
        }), activeTab === "finance" && /*#__PURE__*/ React4.createElement(FinancePane, {
            adapter: adapter2,
            businessId: activeBusinessId
        }), activeTab === "staff" && /*#__PURE__*/ React4.createElement(StaffPane, {
            adapter: adapter2,
            businessId: activeBusinessId
        }), activeTab === "empire" && /*#__PURE__*/ React4.createElement(EmpirePane, {
            adapter: adapter2,
            businessId: activeBusinessId
        }), activeTab === "licenses" && /*#__PURE__*/ React4.createElement(CompliancePane, {
            adapter: adapter2,
            businessId: activeBusinessId
        }), activeTab === "operations" && /*#__PURE__*/ React4.createElement(OperationsPane, {
            adapter: adapter2,
            businessId: activeBusinessId,
            mode: mode
        }), activeTab === "services" && /*#__PURE__*/ React4.createElement(OperationsPane, {
            adapter: adapter2,
            businessId: activeBusinessId,
            mode: mode
        }), activeTab === "status" && /*#__PURE__*/ React4.createElement(CustomerStatusPane, {
            adapter: adapter2,
            businessId: activeBusinessId
        }), activeTab === "town" && /*#__PURE__*/ React4.createElement(TownHallPane, {
            adapter: adapter2
        }), activeTab === "market" && /*#__PURE__*/ React4.createElement(MarketplacePane, {
            adapter: adapter2
        }), activeTab === "guild" && /*#__PURE__*/ React4.createElement(GuildBusinessPane, {
            adapter: adapter2,
            guildId: context === null || context === void 0 ? void 0 : context.actorGuildId
        }));
    };
    var OwnerDashboardPane = ({ adapter: adapter2 , businessId  })=>{
        const dashboard = adapter2.getOwnerDashboard(businessId);
        const report = adapter2.getGrowthReport(businessId);
        const quests = adapter2.getServiceQuests(businessId);
        const miniGame = adapter2.getCustomerMiniGame(businessId);
        const business2 = adapter2.getBusiness(businessId);
        const type = adapter2.getBusinessType(businessId);
        var _type_minimumLicenseLevel;
        const canOpen = Boolean((business2 === null || business2 === void 0 ? void 0 : business2.propertyId) && business2.townId && business2.licenseLevel >= ((_type_minimumLicenseLevel = type === null || type === void 0 ? void 0 : type.minimumLicenseLevel) !== null && _type_minimumLicenseLevel !== void 0 ? _type_minimumLicenseLevel : 1));
        const session = miniGame.activeSession;
        const shiftProgress = session ? `${session.servedTicketIds.length}/${session.queue.length} served` : `Tier ${miniGame.stats.currentTier} service`;
        const shiftHint = session ? `${session.earnedGold} gold earned \xB7 ${session.failedTicketIds.length} missed` : miniGame.dailyReturnTriggers[0];
        return /*#__PURE__*/ React4.createElement("div", {
            style: responsiveGridStyle
        }, /*#__PURE__*/ React4.createElement("section", {
            style: highlightCardStyle
        }, /*#__PURE__*/ React4.createElement("div", null, /*#__PURE__*/ React4.createElement("h3", {
            style: sectionTitleStyle
        }, "Today's Floor"), /*#__PURE__*/ React4.createElement("strong", {
            style: heroMetricStyle
        }, shiftProgress), /*#__PURE__*/ React4.createElement("p", {
            style: mutedTextStyle
        }, shiftHint)), /*#__PURE__*/ React4.createElement("button", {
            className: "biomes-ui-tab",
            type: "button",
            disabled: Boolean(session),
            onClick: ()=>void adapter2.startCustomerSession(businessId),
            style: session ? disabledButtonStyle : void 0
        }, "Start Shift")), dashboard.metrics.map((metric)=>/*#__PURE__*/ React4.createElement(MetricCard, {
                key: metric.id,
                label: metric.label,
                value: metric.value,
                hint: metric.hint
            })), /*#__PURE__*/ React4.createElement("section", {
            style: cardStyle
        }, /*#__PURE__*/ React4.createElement("h3", {
            style: sectionTitleStyle
        }, "Daily Report"), /*#__PURE__*/ React4.createElement("p", {
            style: mutedTextStyle
        }, /*#__PURE__*/ React4.createElement("strong", null, "Earned:"), " ", report.earnedToday), /*#__PURE__*/ React4.createElement("p", {
            style: {
                ...mutedTextStyle,
                marginTop: 6
            }
        }, /*#__PURE__*/ React4.createElement("strong", null, "Costs:"), " ", report.costsToday), /*#__PURE__*/ React4.createElement("p", {
            style: {
                ...mutedTextStyle,
                marginTop: 6
            }
        }, /*#__PURE__*/ React4.createElement("strong", null, "Completed:"), " ", report.completedToday), /*#__PURE__*/ React4.createElement("p", {
            style: {
                ...mutedTextStyle,
                marginTop: 6
            }
        }, /*#__PURE__*/ React4.createElement("strong", null, "Due soon:"), " ", report.expiringSoon)), /*#__PURE__*/ React4.createElement("section", {
            style: cardStyle
        }, /*#__PURE__*/ React4.createElement("h3", {
            style: sectionTitleStyle
        }, "Growth Bottleneck"), /*#__PURE__*/ React4.createElement("p", {
            style: mutedTextStyle
        }, report.bottleneck), /*#__PURE__*/ React4.createElement("p", {
            style: {
                ...mutedTextStyle,
                marginTop: 8
            }
        }, /*#__PURE__*/ React4.createElement("strong", null, "Active work:"), " ", report.activeWork), /*#__PURE__*/ React4.createElement("p", {
            style: {
                ...mutedTextStyle,
                marginTop: 8
            }
        }, /*#__PURE__*/ React4.createElement("strong", null, "Stock focus:"), " ", report.inventoryFocus), /*#__PURE__*/ React4.createElement("p", {
            style: {
                ...mutedTextStyle,
                marginTop: 8
            }
        }, /*#__PURE__*/ React4.createElement("strong", null, "Next upgrade:"), " ", report.nextUpgrade)), /*#__PURE__*/ React4.createElement("section", {
            style: cardStyle
        }, /*#__PURE__*/ React4.createElement("h3", {
            style: sectionTitleStyle
        }, "Rewards Beyond Gold"), report.rewardLayers.map((layer)=>/*#__PURE__*/ React4.createElement("p", {
                key: layer,
                style: mutedTextStyle
            }, layer))), /*#__PURE__*/ React4.createElement("section", {
            style: cardStyle
        }, /*#__PURE__*/ React4.createElement("h3", {
            style: sectionTitleStyle
        }, "Tasks"), (business2 === null || business2 === void 0 ? void 0 : business2.status) !== "open" && /*#__PURE__*/ React4.createElement("button", {
            className: "biomes-ui-tab",
            type: "button",
            disabled: !canOpen,
            onClick: ()=>{
                return canOpen && void adapter2.openBusiness(businessId, business2 === null || business2 === void 0 ? void 0 : business2.propertyId, business2 === null || business2 === void 0 ? void 0 : business2.townId);
            },
            style: !canOpen ? disabledButtonStyle : void 0
        }, "Open Business"), dashboard.todos.length ? dashboard.todos.map((todo)=>/*#__PURE__*/ React4.createElement("p", {
                key: todo.id,
                style: {
                    ...mutedTextStyle,
                    marginTop: 8
                }
            }, /*#__PURE__*/ React4.createElement("strong", null, todo.label, ":"), " ", todo.description)) : /*#__PURE__*/ React4.createElement("p", {
            style: mutedTextStyle
        }, "No urgent tasks.")), /*#__PURE__*/ React4.createElement("section", {
            style: cardStyle
        }, /*#__PURE__*/ React4.createElement("h3", {
            style: sectionTitleStyle
        }, "Field Service Quests"), quests.length ? quests.map((quest)=>/*#__PURE__*/ React4.createElement("p", {
                key: quest.questId,
                style: mutedTextStyle
            }, /*#__PURE__*/ React4.createElement("strong", null, quest.title), /*#__PURE__*/ React4.createElement("br", null), quest.todoText, quest.mapMarkerId ? ` \xB7 Map marker ${displayLabel(quest.mapMarkerId)}` : "")) : /*#__PURE__*/ React4.createElement("p", {
            style: mutedTextStyle
        }, "No accepted field-service quests yet.")));
    };
    var CustomerMiniGamePane = ({ adapter: adapter2 , businessId  })=>{
        var _panel_currentNpc;
        const panel = adapter2.getCustomerMiniGame(businessId);
        const session = panel.activeSession;
        const ticket = panel.currentTicket;
        const [nowMs, setNowMs] = React3.useState(()=>Date.now());
        React3.useEffect(()=>{
            if (!ticket) return;
            const timer = window.setInterval(()=>setNowMs(Date.now()), 1e3);
            return ()=>window.clearInterval(timer);
        }, [
            ticket === null || ticket === void 0 ? void 0 : ticket.ticketId
        ]);
        var _session_servedTicketIds_length;
        const served = (_session_servedTicketIds_length = session === null || session === void 0 ? void 0 : session.servedTicketIds.length) !== null && _session_servedTicketIds_length !== void 0 ? _session_servedTicketIds_length : 0;
        var _session_failedTicketIds_length;
        const failed = (_session_failedTicketIds_length = session === null || session === void 0 ? void 0 : session.failedTicketIds.length) !== null && _session_failedTicketIds_length !== void 0 ? _session_failedTicketIds_length : 0;
        const displayedPatience = ticketPatienceRemaining(ticket, nowMs);
        var _panel_currentNpc_displayName;
        return /*#__PURE__*/ React4.createElement("div", {
            style: responsiveGridStyle
        }, /*#__PURE__*/ React4.createElement(MetricCard, {
            label: "Served",
            value: `${panel.stats.totalServed}`,
            hint: `Best streak ${panel.stats.bestStreak} \xB7 Tier ${panel.stats.currentTier}`
        }), /*#__PURE__*/ React4.createElement(MetricCard, {
            label: "Shift",
            value: session ? `${served}/${session.queue.length}` : "Idle",
            hint: session ? `${session.earnedGold} gold \xB7 ${failed} missed` : panel.dailyReturnTriggers[0]
        }), /*#__PURE__*/ React4.createElement("section", {
            style: cardStyle
        }, /*#__PURE__*/ React4.createElement("h3", {
            style: sectionTitleStyle
        }, panel.definition.interfaceTitle), /*#__PURE__*/ React4.createElement("p", {
            style: mutedTextStyle
        }, panel.definition.ownerFunLoop), /*#__PURE__*/ React4.createElement("div", {
            style: {
                ...formRowStyle,
                marginTop: 12
            }
        }, /*#__PURE__*/ React4.createElement("button", {
            className: "biomes-ui-tab",
            type: "button",
            disabled: Boolean(session),
            onClick: ()=>void adapter2.startCustomerSession(businessId),
            style: session ? disabledButtonStyle : void 0
        }, "Start Shift")), session === null || session === void 0 ? void 0 : session.notes.slice(-3).map((note)=>/*#__PURE__*/ React4.createElement("p", {
                key: note,
                style: {
                    ...mutedTextStyle,
                    marginTop: 6
                }
            }, note))), /*#__PURE__*/ React4.createElement("section", {
            style: cardStyle
        }, /*#__PURE__*/ React4.createElement("h3", {
            style: sectionTitleStyle
        }, "Current Customer"), ticket ? /*#__PURE__*/ React4.createElement(React4.Fragment, null, /*#__PURE__*/ React4.createElement("strong", null, (_panel_currentNpc_displayName = (_panel_currentNpc = panel.currentNpc) === null || _panel_currentNpc === void 0 ? void 0 : _panel_currentNpc.displayName) !== null && _panel_currentNpc_displayName !== void 0 ? _panel_currentNpc_displayName : displayLabel(ticket.npcId)), /*#__PURE__*/ React4.createElement("p", {
            style: {
                ...mutedTextStyle,
                marginTop: 6
            }
        }, ticket.askLine), /*#__PURE__*/ React4.createElement("p", {
            style: {
                ...mutedTextStyle,
                marginTop: 6
            }
        }, "Patience ", displayedPatience, "/", ticket.patience, " \xB7 Difficulty ", ticket.difficulty), /*#__PURE__*/ React4.createElement(RovingGrid, {
            ariaLabel: "Customer service offers",
            items: chunk(panel.offers, 2),
            onActivate: (_row, _col, offer)=>{
                return void adapter2.serveCustomer(businessId, offer.offerId, session === null || session === void 0 ? void 0 : session.sessionId, ticket.ticketId);
            },
            renderCell: (offer, _coords, cell)=>/*#__PURE__*/ React4.createElement("button", {
                    ref: cell.ref,
                    tabIndex: cell.tabIndex,
                    onFocus: cell.onFocus,
                    onKeyDown: cell.onKeyDown,
                    onClick: cell.onClick,
                    className: "biomes-ui-tab",
                    style: serviceButtonStyle,
                    "aria-label": offer.label
                }, /*#__PURE__*/ React4.createElement("strong", null, offer.label), /*#__PURE__*/ React4.createElement("span", {
                    style: mutedTextStyle
                }, offer.description))
        })) : /*#__PURE__*/ React4.createElement("p", {
            style: mutedTextStyle
        }, session ? "This shift is complete." : "Start a shift to bring customer-only NPCs to the counter.")), /*#__PURE__*/ React4.createElement("section", {
            style: cardStyle
        }, /*#__PURE__*/ React4.createElement("h3", {
            style: sectionTitleStyle
        }, "Scale Path"), panel.progressPath.map((step)=>/*#__PURE__*/ React4.createElement("p", {
                key: step,
                style: mutedTextStyle
            }, step)), /*#__PURE__*/ React4.createElement("h3", {
            style: {
                ...sectionTitleStyle,
                marginTop: 10
            }
        }, "Customer Pressure"), panel.challengeGrowth.slice(0, 3).map((step)=>/*#__PURE__*/ React4.createElement("p", {
                key: step,
                style: mutedTextStyle
            }, step))));
    };
    var CustomerOverviewPane = ({ adapter: adapter2 , businessId  })=>{
        const business2 = adapter2.getBusiness(businessId);
        const shop = adapter2.getShopfront(businessId);
        const miniGame = adapter2.getCustomerMiniGame(businessId);
        return /*#__PURE__*/ React4.createElement("div", {
            style: responsiveGridStyle
        }, /*#__PURE__*/ React4.createElement(MetricCard, {
            label: "Satisfaction",
            value: `${business2.customerSatisfaction}/100`,
            hint: `Reputation ${business2.reputation}`
        }), /*#__PURE__*/ React4.createElement(MetricCard, {
            label: "Stock",
            value: `${shop.inventory.length}`,
            hint: "public inventory stacks"
        }), /*#__PURE__*/ React4.createElement("section", {
            style: cardStyle
        }, /*#__PURE__*/ React4.createElement("h3", {
            style: sectionTitleStyle
        }, "How to use this business"), /*#__PURE__*/ React4.createElement("p", {
            style: mutedTextStyle
        }, miniGame.definition.customerGoal), /*#__PURE__*/ React4.createElement("p", {
            style: {
                ...mutedTextStyle,
                marginTop: 8
            }
        }, miniGame.dailyReturnTriggers[0])));
    };
    var ContractBoardPane = ({ adapter: adapter2 , businessId  })=>{
        const board = adapter2.getContractBoard(businessId);
        return /*#__PURE__*/ React4.createElement("div", {
            style: responsiveGridStyle
        }, /*#__PURE__*/ React4.createElement(ContractList, {
            title: "Open Orders",
            contracts: board.open,
            renderAction: (contract)=>/*#__PURE__*/ React4.createElement("button", {
                    className: "biomes-ui-tab",
                    type: "button",
                    onClick: ()=>void adapter2.acceptContract(businessId, contract.contractId)
                }, "Accept")
        }), /*#__PURE__*/ React4.createElement(ContractList, {
            title: "Active Orders",
            contracts: board.active,
            renderAction: (contract)=>/*#__PURE__*/ React4.createElement("button", {
                    className: "biomes-ui-tab",
                    type: "button",
                    onClick: ()=>void adapter2.fulfillContract(businessId, contract.contractId)
                }, "Fulfill")
        }), /*#__PURE__*/ React4.createElement(ContractList, {
            title: "Customer Status",
            contracts: board.customer
        }));
    };
    var ContractList = ({ title , contracts , renderAction  })=>{
        /*#__PURE__*/ return React4.createElement("section", {
            style: cardStyle
        }, /*#__PURE__*/ React4.createElement("h3", {
            style: sectionTitleStyle
        }, title), contracts.length ? contracts.map((contract)=>{
            /*#__PURE__*/ return React4.createElement("div", {
                key: contract.contractId,
                style: rowCardStyle
            }, /*#__PURE__*/ React4.createElement("div", null, /*#__PURE__*/ React4.createElement("strong", null, contract.title), /*#__PURE__*/ React4.createElement("p", {
                style: mutedTextStyle
            }, displayLabel(contract.status), " \xB7 ", contract.rewardGold, " gold \xB7 due ", new Date(contract.deadlineAtMs).toLocaleDateString())), renderAction === null || renderAction === void 0 ? void 0 : renderAction(contract));
        }) : /*#__PURE__*/ React4.createElement("p", {
            style: mutedTextStyle
        }, "No matching orders."));
    };
    var ShopfrontPane = ({ adapter: adapter2 , businessId , mode  })=>{
        const shop = adapter2.getShopfront(businessId);
        const [itemId, setItemId] = React3.useState("");
        const [count, setCount] = React3.useState("1");
        const [priceItemId, setPriceItemId] = React3.useState("");
        const [priceModifier, setPriceModifier] = React3.useState("1");
        const parsedCount = Math.max(1, Number(count) || 1);
        return /*#__PURE__*/ React4.createElement("section", {
            style: cardStyle
        }, /*#__PURE__*/ React4.createElement("h3", {
            style: sectionTitleStyle
        }, mode === "owner" ? "Shopfront & Inventory" : "Shopfront"), mode === "owner" ? /*#__PURE__*/ React4.createElement(React4.Fragment, null, /*#__PURE__*/ React4.createElement("div", {
            style: formRowStyle
        }, /*#__PURE__*/ React4.createElement("input", {
            "aria-label": "Item",
            placeholder: "Item",
            style: inputStyle,
            value: itemId,
            onChange: (event)=>setItemId(event.currentTarget.value)
        }), /*#__PURE__*/ React4.createElement("input", {
            "aria-label": "Count",
            placeholder: "Count",
            style: {
                ...inputStyle,
                width: 84
            },
            value: count,
            onChange: (event)=>setCount(event.currentTarget.value)
        }), /*#__PURE__*/ React4.createElement("button", {
            className: "biomes-ui-tab",
            type: "button",
            onClick: ()=>itemId && void adapter2.depositInventory(businessId, itemId, parsedCount)
        }, "Deposit"), /*#__PURE__*/ React4.createElement("button", {
            className: "biomes-ui-tab",
            type: "button",
            onClick: ()=>itemId && void adapter2.withdrawInventory(businessId, itemId, parsedCount)
        }, "Withdraw")), /*#__PURE__*/ React4.createElement("div", {
            style: formRowStyle
        }, /*#__PURE__*/ React4.createElement("input", {
            "aria-label": "Price Item",
            placeholder: "Price Item",
            style: inputStyle,
            value: priceItemId,
            onChange: (event)=>setPriceItemId(event.currentTarget.value)
        }), /*#__PURE__*/ React4.createElement("input", {
            "aria-label": "Price Modifier",
            placeholder: "Modifier",
            style: {
                ...inputStyle,
                width: 104
            },
            value: priceModifier,
            onChange: (event)=>setPriceModifier(event.currentTarget.value)
        }), /*#__PURE__*/ React4.createElement("button", {
            className: "biomes-ui-tab",
            type: "button",
            onClick: ()=>priceItemId && void adapter2.setPrices(businessId, {
                    [priceItemId]: Number(priceModifier) || 1
                })
        }, "Set Price"))) : /*#__PURE__*/ React4.createElement("div", {
            style: formRowStyle
        }, /*#__PURE__*/ React4.createElement("label", {
            style: labelInlineStyle
        }, "Quantity", /*#__PURE__*/ React4.createElement("input", {
            "aria-label": "Purchase quantity",
            style: {
                ...inputStyle,
                width: 86
            },
            value: count,
            onChange: (event)=>setCount(event.currentTarget.value)
        }))), /*#__PURE__*/ React4.createElement(InventoryGrid, {
            inventory: shop.inventory,
            emptyLabel: shop.emptyLabel,
            actionLabel: mode === "customer" ? "Buy" : void 0,
            onActivate: mode === "customer" ? (item)=>void adapter2.purchaseShopItem(businessId, item.itemId, parsedCount) : void 0
        }));
    };
    var InventoryGrid = ({ inventory: inventory2 , emptyLabel , actionLabel , onActivate  })=>{
        if (!inventory2.length) return /*#__PURE__*/ React4.createElement("p", {
            style: mutedTextStyle
        }, emptyLabel);
        return /*#__PURE__*/ React4.createElement(RovingGrid, {
            ariaLabel: "Business shopfront inventory",
            items: chunk(inventory2, 4),
            onActivate: (_row, _col, item)=>{
                return onActivate === null || onActivate === void 0 ? void 0 : onActivate(item);
            },
            renderCell: (item, _coords, cell)=>{
                const itemLabel = displayLabel(item.itemId);
                return /*#__PURE__*/ React4.createElement("button", {
                    ref: cell.ref,
                    tabIndex: cell.tabIndex,
                    onFocus: cell.onFocus,
                    onKeyDown: cell.onKeyDown,
                    onClick: cell.onClick,
                    className: "biomes-ui-slot",
                    style: {
                        width: 150,
                        minHeight: 86,
                        padding: 8,
                        flexDirection: "column"
                    },
                    "aria-label": `${actionLabel ? `${actionLabel} ` : ""}${itemLabel} x${item.count}`
                }, /*#__PURE__*/ React4.createElement("strong", {
                    style: {
                        fontSize: 12
                    }
                }, itemLabel), /*#__PURE__*/ React4.createElement("span", {
                    style: mutedTextStyle
                }, "x", item.count, " \xB7 ", item.priceGold, " gold"), actionLabel && /*#__PURE__*/ React4.createElement("span", {
                    style: actionTextStyle
                }, actionLabel));
            }
        });
    };
    var FinancePane = ({ adapter: adapter2 , businessId  })=>{
        const panel = adapter2.getFinancePanel(businessId);
        const [amount, setAmount] = React3.useState("100");
        return /*#__PURE__*/ React4.createElement("div", {
            style: responsiveGridStyle
        }, /*#__PURE__*/ React4.createElement(MetricCard, {
            label: "Business Funds",
            value: `${panel.summary.balanceGold}`,
            hint: `Daily costs ${panel.summary.dailyUpkeepGold + panel.summary.dailyRentGold + panel.summary.dailyWagesGold}`
        }), /*#__PURE__*/ React4.createElement(MetricCard, {
            label: "Bank",
            value: `${panel.summary.bankBalanceGold}`,
            hint: `${panel.audit.length} audit events`
        }), /*#__PURE__*/ React4.createElement(MetricCard, {
            label: "Debt",
            value: `${panel.summary.debtGold}`,
            hint: `${panel.loans.length} loans \xB7 ${panel.insurancePolicies.length} policies`
        }), /*#__PURE__*/ React4.createElement("section", {
            style: cardStyle
        }, /*#__PURE__*/ React4.createElement("h3", {
            style: sectionTitleStyle
        }, "Banking"), /*#__PURE__*/ React4.createElement("label", {
            style: labelStyle
        }, "Gold amount", /*#__PURE__*/ React4.createElement("input", {
            style: inputStyle,
            value: amount,
            onChange: (event)=>setAmount(event.currentTarget.value)
        })), /*#__PURE__*/ React4.createElement("div", {
            style: formRowStyle
        }, /*#__PURE__*/ React4.createElement("button", {
            className: "biomes-ui-tab",
            type: "button",
            onClick: ()=>void adapter2.createBankAccount(businessId)
        }, "Create Account"), /*#__PURE__*/ React4.createElement("button", {
            className: "biomes-ui-tab",
            type: "button",
            onClick: ()=>void adapter2.transferPersonalToBusinessBank(businessId, Math.max(1, Number(amount) || 1))
        }, "Deposit"), /*#__PURE__*/ React4.createElement("button", {
            className: "biomes-ui-tab",
            type: "button",
            onClick: ()=>void adapter2.transferBusinessToPersonalBank(businessId, Math.max(1, Number(amount) || 1))
        }, "Withdraw"))));
    };
    var StaffPane = ({ adapter: adapter2 , businessId  })=>{
        const panel = adapter2.getStaffPanel(businessId);
        const [role, setRole] = React3.useState("Worker");
        const [wage, setWage] = React3.useState("12");
        const [assignedTask, setAssignedTask] = React3.useState("front_counter");
        const [targetActorId, setTargetActorId] = React3.useState("");
        const [permission, setPermission] = React3.useState("employee_manager");
        return /*#__PURE__*/ React4.createElement("section", {
            style: cardStyle
        }, /*#__PURE__*/ React4.createElement("h3", {
            style: sectionTitleStyle
        }, "Staff"), /*#__PURE__*/ React4.createElement("div", {
            style: formRowStyle
        }, /*#__PURE__*/ React4.createElement("input", {
            "aria-label": "Worker role",
            style: inputStyle,
            value: role,
            onChange: (event)=>setRole(event.currentTarget.value)
        }), /*#__PURE__*/ React4.createElement("input", {
            "aria-label": "Daily wage",
            style: {
                ...inputStyle,
                width: 84
            },
            value: wage,
            onChange: (event)=>setWage(event.currentTarget.value)
        }), /*#__PURE__*/ React4.createElement("button", {
            className: "biomes-ui-tab",
            type: "button",
            onClick: ()=>void adapter2.hireWorker(businessId, role, Math.max(1, Number(wage) || 1))
        }, "Hire"), /*#__PURE__*/ React4.createElement("button", {
            className: "biomes-ui-tab",
            type: "button",
            onClick: ()=>void adapter2.payPayroll(businessId)
        }, "Pay Payroll"), /*#__PURE__*/ React4.createElement("button", {
            className: "biomes-ui-tab",
            type: "button",
            onClick: ()=>void adapter2.refreshEmployeeCandidates(businessId, 3)
        }, "Find Help")), /*#__PURE__*/ React4.createElement("div", {
            style: formRowStyle
        }, /*#__PURE__*/ React4.createElement("select", {
            "aria-label": "Assigned task",
            style: inputStyle,
            value: assignedTask,
            onChange: (event)=>setAssignedTask(event.currentTarget.value)
        }, /*#__PURE__*/ React4.createElement("option", {
            value: "front_counter"
        }, "Front Counter"), /*#__PURE__*/ React4.createElement("option", {
            value: "stock_runner"
        }, "Stock Runner"), /*#__PURE__*/ React4.createElement("option", {
            value: "production_station"
        }, "Production Station"), /*#__PURE__*/ React4.createElement("option", {
            value: "quality_check"
        }, "Quality Check"), /*#__PURE__*/ React4.createElement("option", {
            value: "cleanup_route"
        }, "Cleanup Route"), /*#__PURE__*/ React4.createElement("option", {
            value: "dispatch_runner"
        }, "Dispatch Runner"), /*#__PURE__*/ React4.createElement("option", {
            value: "branch_manager"
        }, "Branch Manager"), /*#__PURE__*/ React4.createElement("option", {
            value: "rest_required"
        }, "Rest Required")), /*#__PURE__*/ React4.createElement("input", {
            "aria-label": "Permission target actor",
            placeholder: "Player name",
            style: inputStyle,
            value: targetActorId,
            onChange: (event)=>setTargetActorId(event.currentTarget.value)
        }), /*#__PURE__*/ React4.createElement("select", {
            "aria-label": "Permission",
            style: inputStyle,
            value: permission,
            onChange: (event)=>setPermission(event.currentTarget.value)
        }, /*#__PURE__*/ React4.createElement("option", {
            value: "employee_manager"
        }, "Employee Manager"), /*#__PURE__*/ React4.createElement("option", {
            value: "accountant"
        }, "Accountant"), /*#__PURE__*/ React4.createElement("option", {
            value: "inventory_manager"
        }, "Inventory Manager"), /*#__PURE__*/ React4.createElement("option", {
            value: "contract_manager"
        }, "Contract Manager"), /*#__PURE__*/ React4.createElement("option", {
            value: "price_manager"
        }, "Price Manager"), /*#__PURE__*/ React4.createElement("option", {
            value: "world_operator"
        }, "World Operator"), /*#__PURE__*/ React4.createElement("option", {
            value: "owner_admin"
        }, "Owner Admin")), /*#__PURE__*/ React4.createElement("button", {
            className: "biomes-ui-tab",
            type: "button",
            onClick: ()=>targetActorId && void adapter2.grantPermission(businessId, targetActorId, [
                    permission
                ])
        }, "Grant")), /*#__PURE__*/ React4.createElement("p", {
            style: mutedTextStyle
        }, "Payroll due: ", panel.payrollDueGold, " gold \xB7 Low morale: ", panel.moraleWarnings.length), panel.employees.length ? panel.employees.map((employee)=>/*#__PURE__*/ React4.createElement("div", {
                key: employee.employeeId,
                style: rowCardStyle
            }, /*#__PURE__*/ React4.createElement("div", null, /*#__PURE__*/ React4.createElement("strong", null, displayLabel(employee.role)), /*#__PURE__*/ React4.createElement("p", {
                style: mutedTextStyle
            }, "Skill ", employee.skill, " \xB7 Wage ", employee.wageGoldPerDay, "/day \xB7 Morale ", employee.morale, " \xB7 Task ", employee.assignedTask ? displayLabel(employee.assignedTask) : "Unassigned")), /*#__PURE__*/ React4.createElement("div", {
                style: formRowStyle
            }, /*#__PURE__*/ React4.createElement("button", {
                className: "biomes-ui-tab",
                type: "button",
                onClick: ()=>void adapter2.assignWorker(businessId, employee.employeeId, assignedTask)
            }, "Assign"), /*#__PURE__*/ React4.createElement("button", {
                className: "biomes-ui-tab",
                type: "button",
                onClick: ()=>void adapter2.runEmployeeTask(businessId, employee.employeeId, assignedTask)
            }, "Run Task"), /*#__PURE__*/ React4.createElement("button", {
                className: "biomes-ui-tab",
                type: "button",
                onClick: ()=>void adapter2.trainWorker(businessId, employee.employeeId)
            }, "Train"), /*#__PURE__*/ React4.createElement("button", {
                className: "biomes-ui-tab",
                type: "button",
                onClick: ()=>void adapter2.promoteWorker(businessId, employee.employeeId, assignedTask)
            }, "Promote"), /*#__PURE__*/ React4.createElement("button", {
                className: "biomes-ui-tab",
                type: "button",
                onClick: ()=>void adapter2.fireWorker(businessId, employee.employeeId)
            }, "Fire")))) : /*#__PURE__*/ React4.createElement("p", {
            style: mutedTextStyle
        }, "No workers are assigned yet."), panel.candidates.length ? /*#__PURE__*/ React4.createElement(React4.Fragment, null, /*#__PURE__*/ React4.createElement("h3", {
            style: sectionTitleStyle
        }, "Candidates"), panel.candidates.map((candidate)=>/*#__PURE__*/ React4.createElement("div", {
                key: candidate.candidateId,
                style: rowCardStyle
            }, /*#__PURE__*/ React4.createElement("div", null, /*#__PURE__*/ React4.createElement("strong", null, candidate.displayName), /*#__PURE__*/ React4.createElement("p", {
                style: mutedTextStyle
            }, displayLabel(candidate.role), " \xB7 Skill ", candidate.skill, " \xB7 Asks ", candidate.wageAskGoldPerDay, "/day \xB7 ", displayLabel(candidate.status)), /*#__PURE__*/ React4.createElement("p", {
                style: mutedTextStyle
            }, displayLabel(candidate.personality), " \xB7 ", displayLabel(candidate.schedule), " \xB7 Prefers ", displayLabel(candidate.workplacePreference))), /*#__PURE__*/ React4.createElement("div", {
                style: formRowStyle
            }, /*#__PURE__*/ React4.createElement("button", {
                className: "biomes-ui-tab",
                type: "button",
                onClick: ()=>void adapter2.interviewEmployeeCandidate(businessId, candidate.candidateId, "friendly")
            }, "Interview"), /*#__PURE__*/ React4.createElement("button", {
                className: "biomes-ui-tab",
                type: "button",
                onClick: ()=>void adapter2.negotiateEmployeeCandidate(businessId, candidate.candidateId, candidate.wageAskGoldPerDay)
            }, "Offer"), /*#__PURE__*/ React4.createElement("button", {
                className: "biomes-ui-tab",
                type: "button",
                onClick: ()=>void adapter2.hireEmployeeCandidate(businessId, candidate.candidateId)
            }, "Hire"))))) : null, panel.recentTaskRuns.length ? /*#__PURE__*/ React4.createElement(React4.Fragment, null, /*#__PURE__*/ React4.createElement("h3", {
            style: sectionTitleStyle
        }, "Recent Staff Actions"), panel.recentTaskRuns.map((run)=>/*#__PURE__*/ React4.createElement("div", {
                key: run.taskRunId,
                style: rowCardStyle
            }, /*#__PURE__*/ React4.createElement("div", null, /*#__PURE__*/ React4.createElement("strong", null, displayLabel(run.taskKind)), /*#__PURE__*/ React4.createElement("p", {
                style: mutedTextStyle
            }, displayLabel(run.status), " \xB7 Path ", run.employeePath.length, " steps \xB7 Animation ", displayLabel(run.animationFamily)))))) : null);
    };
    var EmpirePane = ({ adapter: adapter2 , businessId  })=>{
        var _shop_inventory_;
        const panel = adapter2.getEmpirePanel(businessId);
        const staff = adapter2.getStaffPanel(businessId).employees;
        const shop = adapter2.getShopfront(businessId);
        var _shop_inventory__itemId;
        const [routeItemId, setRouteItemId] = React3.useState((_shop_inventory__itemId = (_shop_inventory_ = shop.inventory[0]) === null || _shop_inventory_ === void 0 ? void 0 : _shop_inventory_.itemId) !== null && _shop_inventory__itemId !== void 0 ? _shop_inventory__itemId : "");
        const [routeCount, setRouteCount] = React3.useState("1");
        var _panel_branches_find;
        const firstBranch = (_panel_branches_find = panel.branches.find((branch)=>branch.status === "active")) !== null && _panel_branches_find !== void 0 ? _panel_branches_find : panel.branches[0];
        const firstEmployee = staff[0];
        const branchDashboard = firstBranch ? panel.dashboards.find((dashboard)=>dashboard.branchId === firstBranch.branchId) : void 0;
        var _branch_warehouseInventory, _branch_warehouseSlots, _branch_scheduledStaffIds, _branch_regionalDemandMultiplier, _branch_competitorPressure;
        return /*#__PURE__*/ React4.createElement("div", {
            style: responsiveGridStyle
        }, /*#__PURE__*/ React4.createElement(MetricCard, {
            label: "Branches",
            value: `${panel.branches.length}`,
            hint: `${panel.outpostBuildings.length} branch sites available`
        }), /*#__PURE__*/ React4.createElement(MetricCard, {
            label: "Daily Branch Revenue",
            value: `${panel.dailyRevenueGold}`,
            hint: `Upkeep ${panel.dailyUpkeepGold}`
        }), /*#__PURE__*/ React4.createElement(MetricCard, {
            label: "Branch Profit",
            value: `${panel.lifetimeProfitGold}`,
            hint: `${panel.automations.length} automations assigned`
        }), /*#__PURE__*/ React4.createElement("section", {
            style: cardStyle
        }, /*#__PURE__*/ React4.createElement("h3", {
            style: sectionTitleStyle
        }, "Empire Controls"), /*#__PURE__*/ React4.createElement("div", {
            style: formRowStyle
        }, /*#__PURE__*/ React4.createElement("button", {
            className: "biomes-ui-tab",
            type: "button",
            disabled: !panel.openBranchEligible,
            onClick: ()=>{
                var _panel_outpostBuildings_;
                return void adapter2.openBranch(businessId, (_panel_outpostBuildings_ = panel.outpostBuildings[0]) === null || _panel_outpostBuildings_ === void 0 ? void 0 : _panel_outpostBuildings_.outpostId);
            },
            style: !panel.openBranchEligible ? disabledButtonStyle : void 0
        }, "Open Branch"), /*#__PURE__*/ React4.createElement("button", {
            className: "biomes-ui-tab",
            type: "button",
            disabled: !firstBranch,
            onClick: ()=>firstBranch && void adapter2.assignAutomation(businessId, "branch_manager", firstBranch.branchId),
            style: !firstBranch ? disabledButtonStyle : void 0
        }, "Assign Manager"), /*#__PURE__*/ React4.createElement("button", {
            className: "biomes-ui-tab",
            type: "button",
            disabled: !panel.branches.length,
            onClick: ()=>void adapter2.settleEmpireDay(businessId, 1),
            style: !panel.branches.length ? disabledButtonStyle : void 0
        }, "Collect Day")), /*#__PURE__*/ React4.createElement("div", {
            style: formRowStyle
        }, /*#__PURE__*/ React4.createElement("button", {
            className: "biomes-ui-tab",
            type: "button",
            disabled: !firstBranch || !firstEmployee,
            onClick: ()=>firstBranch && firstEmployee && void adapter2.assignBranchManager(businessId, firstBranch.branchId, firstEmployee.employeeId),
            style: !firstBranch || !firstEmployee ? disabledButtonStyle : void 0
        }, "Set Regional Manager"), /*#__PURE__*/ React4.createElement("button", {
            className: "biomes-ui-tab",
            type: "button",
            disabled: !firstBranch || !staff.length,
            onClick: ()=>firstBranch && void adapter2.scheduleBranchStaff(businessId, firstBranch.branchId, staff.slice(0, firstBranch.staffSlots).map((employee)=>employee.employeeId)),
            style: !firstBranch || !staff.length ? disabledButtonStyle : void 0
        }, "Schedule Staff"), /*#__PURE__*/ React4.createElement("button", {
            className: "biomes-ui-tab",
            type: "button",
            disabled: !firstBranch,
            onClick: ()=>firstBranch && void adapter2.closeBranch(businessId, firstBranch.branchId),
            style: !firstBranch ? disabledButtonStyle : void 0
        }, "Close Branch")), /*#__PURE__*/ React4.createElement("div", {
            style: formRowStyle
        }, /*#__PURE__*/ React4.createElement("input", {
            "aria-label": "Route stock item",
            placeholder: "Stock item",
            style: inputStyle,
            value: routeItemId,
            onChange: (event)=>setRouteItemId(event.currentTarget.value)
        }), /*#__PURE__*/ React4.createElement("input", {
            "aria-label": "Route stock count",
            placeholder: "Count",
            style: {
                ...inputStyle,
                width: 88
            },
            value: routeCount,
            onChange: (event)=>setRouteCount(event.currentTarget.value)
        }), /*#__PURE__*/ React4.createElement("button", {
            className: "biomes-ui-tab",
            type: "button",
            disabled: !firstBranch || !routeItemId,
            onClick: ()=>firstBranch && routeItemId && void adapter2.routeBranchStock(businessId, firstBranch.branchId, routeItemId, Math.max(1, Number(routeCount) || 1)),
            style: !firstBranch || !routeItemId ? disabledButtonStyle : void 0
        }, "Route Stock")), panel.warnings.length ? panel.warnings.map((warning)=>/*#__PURE__*/ React4.createElement("p", {
                key: warning,
                style: mutedTextStyle
            }, formatHarthmereBusinessPlayerWarningV1(warning))) : /*#__PURE__*/ React4.createElement("p", {
            style: mutedTextStyle
        }, "Branches, staff automation, and profit routing are ready.")), /*#__PURE__*/ React4.createElement("section", {
            style: cardStyle
        }, /*#__PURE__*/ React4.createElement("h3", {
            style: sectionTitleStyle
        }, "Branches"), panel.branches.length ? panel.branches.map((branch)=>/*#__PURE__*/ React4.createElement("div", {
                key: branch.branchId,
                style: rowCardStyle
            }, /*#__PURE__*/ React4.createElement("div", null, /*#__PURE__*/ React4.createElement("strong", null, displayLabel(branch.outpostId)), /*#__PURE__*/ React4.createElement("p", {
                style: mutedTextStyle
            }, displayLabel(branch.status), " \xB7 Revenue ", branch.dailyRevenueGold, " \xB7 Upkeep ", branch.dailyUpkeepGold, " \xB7 Queue +", branch.queueCapacityBonus), /*#__PURE__*/ React4.createElement("p", {
                style: mutedTextStyle
            }, "Warehouse ", Object.values((_branch_warehouseInventory = branch.warehouseInventory) !== null && _branch_warehouseInventory !== void 0 ? _branch_warehouseInventory : {}).reduce((sum, count)=>sum + count, 0), "/", (_branch_warehouseSlots = branch.warehouseSlots) !== null && _branch_warehouseSlots !== void 0 ? _branch_warehouseSlots : 0, " \xB7 Staff ", ((_branch_scheduledStaffIds = branch.scheduledStaffIds) !== null && _branch_scheduledStaffIds !== void 0 ? _branch_scheduledStaffIds : []).length, "/", branch.staffSlots, " \xB7 Demand ", Math.round(((_branch_regionalDemandMultiplier = branch.regionalDemandMultiplier) !== null && _branch_regionalDemandMultiplier !== void 0 ? _branch_regionalDemandMultiplier : 1) * 100), "% \xB7 Pressure ", (_branch_competitorPressure = branch.competitorPressure) !== null && _branch_competitorPressure !== void 0 ? _branch_competitorPressure : 0)))) : /*#__PURE__*/ React4.createElement("p", {
            style: mutedTextStyle
        }, "No branches are open yet.")), /*#__PURE__*/ React4.createElement("section", {
            style: cardStyle
        }, /*#__PURE__*/ React4.createElement("h3", {
            style: sectionTitleStyle
        }, "Branch Dashboard"), branchDashboard ? /*#__PURE__*/ React4.createElement("div", {
            style: rowCardStyle
        }, /*#__PURE__*/ React4.createElement("div", null, /*#__PURE__*/ React4.createElement("strong", null, branchDashboard.dailyProfitGold, " gold today"), /*#__PURE__*/ React4.createElement("p", {
            style: mutedTextStyle
        }, "Stock ", branchDashboard.stockUnits, " \xB7 Staff ", Math.round(branchDashboard.staffCoverage * 100), "% \xB7 Demand ", Math.round(branchDashboard.demandMultiplier * 100), "% \xB7 Pressure ", branchDashboard.competitorPressure), /*#__PURE__*/ React4.createElement("p", {
            style: mutedTextStyle
        }, branchDashboard.alerts.join(" \xB7 ")))) : /*#__PURE__*/ React4.createElement("p", {
            style: mutedTextStyle
        }, "Collect a branch day to create the first dashboard.")), /*#__PURE__*/ React4.createElement("section", {
            style: cardStyle
        }, /*#__PURE__*/ React4.createElement("h3", {
            style: sectionTitleStyle
        }, "Automation"), panel.automations.length ? panel.automations.map((automation)=>/*#__PURE__*/ React4.createElement("div", {
                key: automation.automationId,
                style: rowCardStyle
            }, /*#__PURE__*/ React4.createElement("div", null, /*#__PURE__*/ React4.createElement("strong", null, displayLabel(automation.role)), /*#__PURE__*/ React4.createElement("p", {
                style: mutedTextStyle
            }, "Level ", automation.level, " \xB7 Capacity +", automation.serviceCapacityBonus, " \xB7 Profit ", automation.passiveProfitGoldPerDay, "/day \xB7 Upkeep ", automation.dailyUpkeepGold, "/day")))) : /*#__PURE__*/ React4.createElement("p", {
            style: mutedTextStyle
        }, "No branch automation is assigned yet.")));
    };
    var CompliancePane = ({ adapter: adapter2 , businessId  })=>{
        const panel = adapter2.getCompliancePanel(businessId);
        var _panel_minimumLicenseLevel;
        return /*#__PURE__*/ React4.createElement("div", {
            style: responsiveGridStyle
        }, /*#__PURE__*/ React4.createElement(MetricCard, {
            label: "License",
            value: `${displayLabel(panel.licenseClass)} ${panel.licenseLevel}`,
            hint: `Required ${panel.requiredLicense ? displayLabel(panel.requiredLicense) : "None"} level ${(_panel_minimumLicenseLevel = panel.minimumLicenseLevel) !== null && _panel_minimumLicenseLevel !== void 0 ? _panel_minimumLicenseLevel : 0}`
        }), /*#__PURE__*/ React4.createElement(MetricCard, {
            label: "Safety",
            value: `${panel.safetyRating}`,
            hint: "inspection rating"
        }), /*#__PURE__*/ React4.createElement(MetricCard, {
            label: "Sanitation",
            value: `${panel.sanitationRating}`,
            hint: "inspection rating"
        }), /*#__PURE__*/ React4.createElement("section", {
            style: cardStyle
        }, /*#__PURE__*/ React4.createElement("h3", {
            style: sectionTitleStyle
        }, "Warnings"), panel.warnings.length ? panel.warnings.map((warning)=>/*#__PURE__*/ React4.createElement("p", {
                key: warning,
                style: mutedTextStyle
            }, formatHarthmereBusinessPlayerWarningV1(warning))) : /*#__PURE__*/ React4.createElement("p", {
            style: mutedTextStyle
        }, "No current compliance warnings.")));
    };
    var OperationsPane = ({ adapter: adapter2 , businessId , mode  })=>{
        const screen = adapter2.getOperationScreen(businessId);
        const actions = mode === "owner" ? screen.ownerActions : screen.customerActions;
        return /*#__PURE__*/ React4.createElement("section", {
            style: cardStyle
        }, /*#__PURE__*/ React4.createElement("h3", {
            style: sectionTitleStyle
        }, screen.title, " Operations"), actions.length ? /*#__PURE__*/ React4.createElement(RovingGrid, {
            ariaLabel: "Business operation actions",
            items: chunk(actions, 3),
            onActivate: (_row, _col, action)=>mode === "owner" ? void adapter2.runServiceAction(businessId, action.actionId) : void adapter2.requestCustomerService(businessId, action.actionId),
            renderCell: (action, _coords, cell)=>/*#__PURE__*/ React4.createElement("button", {
                    ref: cell.ref,
                    tabIndex: cell.tabIndex,
                    onFocus: cell.onFocus,
                    onKeyDown: cell.onKeyDown,
                    onClick: cell.onClick,
                    className: "biomes-ui-tab",
                    style: serviceButtonStyle,
                    "aria-label": action.label
                }, /*#__PURE__*/ React4.createElement("strong", null, action.label), /*#__PURE__*/ React4.createElement("span", {
                    style: mutedTextStyle
                }, action.description))
        }) : /*#__PURE__*/ React4.createElement("p", {
            style: mutedTextStyle
        }, "No actions are available for this business type."), /*#__PURE__*/ React4.createElement("div", {
            style: {
                marginTop: 12
            }
        }, /*#__PURE__*/ React4.createElement("h3", {
            style: sectionTitleStyle
        }, "World Records"), /*#__PURE__*/ React4.createElement("p", {
            style: mutedTextStyle
        }, Object.entries(screen.systemRecords).filter(([, rows])=>rows.length > 0).map(([name, rows])=>`${displayLabel(name)}: ${rows.length}`).join(" \xB7 ") || "No linked world records yet.")));
    };
    var CustomerStatusPane = ({ adapter: adapter2 , businessId  })=>{
        const orders = adapter2.getCustomerOrders(businessId);
        const business2 = adapter2.getBusiness(businessId);
        const miniGame = adapter2.getCustomerMiniGame(businessId);
        const activeCount = orders.filter((order)=>order.status === "active").length;
        var _business2_customerSatisfaction, _business2_reputation;
        return /*#__PURE__*/ React4.createElement("div", {
            style: responsiveGridStyle
        }, /*#__PURE__*/ React4.createElement(MetricCard, {
            label: "Requests",
            value: `${orders.length}`,
            hint: `${activeCount} active`
        }), /*#__PURE__*/ React4.createElement(MetricCard, {
            label: "Business Trust",
            value: `${(_business2_customerSatisfaction = business2 === null || business2 === void 0 ? void 0 : business2.customerSatisfaction) !== null && _business2_customerSatisfaction !== void 0 ? _business2_customerSatisfaction : 0}/100`,
            hint: `Reputation ${(_business2_reputation = business2 === null || business2 === void 0 ? void 0 : business2.reputation) !== null && _business2_reputation !== void 0 ? _business2_reputation : 0}`
        }), /*#__PURE__*/ React4.createElement("section", {
            style: cardStyle
        }, /*#__PURE__*/ React4.createElement("h3", {
            style: sectionTitleStyle
        }, "Next Step"), /*#__PURE__*/ React4.createElement("p", {
            style: mutedTextStyle
        }, orders.length ? "Track accepted work here until the owner fulfills it." : `Use Services to request work from this business. ${miniGame.definition.customerGoal}`)), /*#__PURE__*/ React4.createElement(ContractList, {
            title: "Your Requests",
            contracts: orders
        }));
    };
    var TownHallPane = ({ adapter: adapter2  })=>{
        const panel = adapter2.getTownHallPanel();
        return /*#__PURE__*/ React4.createElement("div", {
            style: responsiveGridStyle
        }, /*#__PURE__*/ React4.createElement(MetricCard, {
            label: "Towns",
            value: `${panel.towns.length}`,
            hint: "tracked public economies"
        }), /*#__PURE__*/ React4.createElement(MetricCard, {
            label: "Public Contracts",
            value: `${panel.publicContracts.length}`,
            hint: "town or civic contracts"
        }), /*#__PURE__*/ React4.createElement(MetricCard, {
            label: "Town Businesses",
            value: `${panel.townBusinesses.length}`,
            hint: "public utilities and services"
        }));
    };
    var MarketplacePane = ({ adapter: adapter2  })=>{
        const panel = adapter2.getMarketplacePanel();
        return /*#__PURE__*/ React4.createElement("section", {
            style: cardStyle
        }, /*#__PURE__*/ React4.createElement("h3", {
            style: sectionTitleStyle
        }, "Marketplace"), /*#__PURE__*/ React4.createElement("p", {
            style: mutedTextStyle
        }, panel.openOrders.length, " open orders \xB7 ", Object.keys(panel.regionalPrices).length, " regional prices"), panel.openOrders.slice(0, 8).map((order)=>/*#__PURE__*/ React4.createElement("div", {
                key: order.orderId,
                style: rowCardStyle
            }, /*#__PURE__*/ React4.createElement("div", null, /*#__PURE__*/ React4.createElement("strong", null, displayLabel(order.itemId)), /*#__PURE__*/ React4.createElement("p", {
                style: mutedTextStyle
            }, displayLabel(order.kind), " \xB7 x", order.count, " \xB7 ", order.unitPriceGold, " gold")))));
    };
    var GuildBusinessPane = ({ adapter: adapter2 , guildId  })=>{
        const panel = adapter2.getGuildBusinessPanel(guildId);
        const permissionCount = Object.values(panel.permissions).reduce((sum, permissions)=>sum + permissions.length, 0);
        var _panel_permissions_business2_businessId;
        return /*#__PURE__*/ React4.createElement("div", {
            style: responsiveGridStyle
        }, /*#__PURE__*/ React4.createElement(MetricCard, {
            label: "Guild Businesses",
            value: `${panel.guildBusinesses.length}`,
            hint: "shared ownership records"
        }), /*#__PURE__*/ React4.createElement(MetricCard, {
            label: "Guild Contracts",
            value: `${panel.guildContracts.length}`,
            hint: "shared work and civic obligations"
        }), /*#__PURE__*/ React4.createElement(MetricCard, {
            label: "Your Permissions",
            value: `${permissionCount}`,
            hint: "roles granted to this actor"
        }), /*#__PURE__*/ React4.createElement("section", {
            style: cardStyle
        }, /*#__PURE__*/ React4.createElement("h3", {
            style: sectionTitleStyle
        }, "Guild Businesses"), panel.guildBusinesses.length ? panel.guildBusinesses.map((business2)=>/*#__PURE__*/ React4.createElement("div", {
                key: business2.businessId,
                style: rowCardStyle
            }, /*#__PURE__*/ React4.createElement("div", null, /*#__PURE__*/ React4.createElement("strong", null, business2.name), /*#__PURE__*/ React4.createElement("p", {
                style: mutedTextStyle
            }, displayLabel(business2.typeId), " \xB7 Permissions ", ((_panel_permissions_business2_businessId = panel.permissions[business2.businessId]) !== null && _panel_permissions_business2_businessId !== void 0 ? _panel_permissions_business2_businessId : []).map(displayLabel).join(", ") || "None")))) : /*#__PURE__*/ React4.createElement("p", {
            style: mutedTextStyle
        }, "No guild-owned businesses are available to this actor yet. Start or join a guild business to share staff, contracts, and branch work.")), /*#__PURE__*/ React4.createElement(ContractList, {
            title: "Guild Contracts",
            contracts: panel.guildContracts
        }));
    };
    var MetricCard = ({ label , value , hint  })=>/*#__PURE__*/ React4.createElement("section", {
            style: metricCardStyle
        }, /*#__PURE__*/ React4.createElement("h3", {
            style: sectionTitleStyle
        }, label), /*#__PURE__*/ React4.createElement("strong", {
            style: {
                display: "block",
                fontSize: 22,
                marginBottom: 4
            }
        }, value), /*#__PURE__*/ React4.createElement("p", {
            style: mutedTextStyle
        }, hint));
    var panelTitleStyle = {
        margin: 0,
        fontSize: 22,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: "var(--biomes-fg)"
    };
    var sectionTitleStyle = {
        margin: "0 0 8px",
        fontSize: 11,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: "var(--biomes-fg-muted)"
    };
    var mutedTextStyle = {
        margin: 0,
        fontSize: 12,
        color: "var(--biomes-fg-muted)",
        lineHeight: 1.45
    };
    var cardStyle = {
        padding: 12,
        background: "var(--biomes-bg-glass)",
        border: "1px solid var(--biomes-edge-cyan-soft)",
        borderRadius: 4
    };
    var metricCardStyle = {
        ...cardStyle,
        minHeight: 92,
        boxSizing: "border-box"
    };
    var highlightCardStyle = {
        ...cardStyle,
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        gap: 12,
        alignItems: "center",
        background: "linear-gradient(135deg, rgba(70, 104, 139, 0.28), rgba(17, 23, 34, 0.92))",
        borderColor: "rgba(154, 199, 230, 0.42)",
        minHeight: 108,
        boxSizing: "border-box"
    };
    var heroMetricStyle = {
        display: "block",
        fontSize: 24,
        marginBottom: 4,
        color: "var(--biomes-fg)"
    };
    var rowCardStyle = {
        ...cardStyle,
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        gap: 10,
        alignItems: "center",
        marginTop: 8
    };
    var responsiveGridStyle = {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 12,
        alignItems: "start"
    };
    var inputStyle = {
        minWidth: 0,
        padding: "7px 9px",
        color: "var(--biomes-fg)",
        background: "var(--biomes-bg-deep)",
        border: "1px solid var(--biomes-edge-cyan-soft)",
        borderRadius: 4
    };
    var labelStyle = {
        display: "grid",
        gap: 4,
        marginBottom: 8,
        fontSize: 11,
        color: "var(--biomes-fg-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.12em"
    };
    var labelInlineStyle = {
        display: "flex",
        gap: 8,
        alignItems: "center",
        fontSize: 11,
        color: "var(--biomes-fg-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.12em"
    };
    var formRowStyle = {
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        marginBottom: 12
    };
    var actionTextStyle = {
        marginTop: 2,
        fontSize: 11,
        color: "var(--biomes-fg)",
        textTransform: "uppercase",
        letterSpacing: "0.08em"
    };
    var disabledButtonStyle = {
        opacity: 0.55,
        cursor: "not-allowed"
    };
    var serviceButtonStyle = {
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "flex-start",
        gap: 6,
        width: "100%",
        minWidth: 0,
        minHeight: 96,
        whiteSpace: "normal",
        textAlign: "left",
        border: "1px solid var(--biomes-edge-cyan-soft)",
        background: "var(--biomes-bg-glass)",
        borderRadius: 4,
        textTransform: "none",
        letterSpacing: 0
    };
    // artifacts/harthmere/business-interface-live-audit-v1/entry.tsx
    var businessLabels = {
        exotic_matter_refinery: "Exotic Matter Refinery",
        biome_maintenance_repair: "Biome Maintenance & Repair",
        biome_design_studio: "Biome Design Studio",
        security_defense_contractor: "Security & Defense Contractor",
        portal_transit_company: "Portal Transit Company",
        biome_farming_rare_foods: "Biome Farming & Rare Foods",
        weapons_tools: "Weapons & Tools",
        magic_goods: "Magic Goods",
        exploration_guide: "Exploration Guide",
        custom_home_property_development: "Custom Home & Property Development",
        general_trader: "General Trader",
        hunter_wild_meat: "Hunter For Wild Meat",
        medical_doctor: "Medical Clinic",
        teleport_owner: "Teleport Owner",
        waste_sanitation_cleanup: "Waste & Sanitation Cleanup",
        repair_maintenance_person: "Repair & Maintenance",
        food_service_restaurant: "Food Service Restaurant",
        courier: "Courier",
        hospitality_inn_hotel_shelter: "Hospitality Inn & Shelter"
    };
    function businessType(typeId) {
        return {
            typeId,
            displayName: businessLabels[typeId],
            category: "business",
            startCostGold: 100,
            materialNeed: "medium",
            baseStorageSlots: 24,
            baseUpkeepGoldPerDay: 8,
            requiredLicense: "basic trade",
            minimumLicenseLevel: 1,
            serviceNeeds: [
                "food",
                "maintenance",
                "logistics"
            ],
            inputItemFamilies: [
                "service stock"
            ],
            outputItemFamilies: [
                "customer service"
            ],
            riskLevel: 2,
            civicImportance: 2
        };
    }
    var allServiceItems = [
        "worker_meal",
        "rare_seed",
        "road_ration",
        "repair_part",
        "trade_goods",
        "certified_portal_fuel",
        "stabilized_exotic_matter",
        "containment_filter",
        "portal_fuel",
        "anchor_part",
        "repair_kit",
        "decor",
        "design_pack",
        "lighting_kit",
        "guard_contract",
        "route_map",
        "ration_pack",
        "signal_flare",
        "lockbox",
        "destination_crystal",
        "crop_bundle",
        "herb_bundle",
        "rare_food",
        "clean_water",
        "repair_tool",
        "metal_part",
        "iron_ingot",
        "whetstone",
        "crystal_lens",
        "charm",
        "potion",
        "ward",
        "relic_fragment",
        "field_kit",
        "blueprint",
        "permit_form",
        "wood_plank",
        "stone_block",
        "wild_meat",
        "hide",
        "bandage",
        "field_medkit",
        "medicine",
        "teleport_token",
        "emergency_return",
        "teleport_fuel",
        "containment_barrel",
        "cleaning_reagent",
        "clean_certificate",
        "nails",
        "parcel",
        "sealed_package",
        "linen"
    ];
    function inventory() {
        return Object.fromEntries(allServiceItems.map((itemId, index)=>[
                itemId,
                {
                    itemId,
                    count: 6 + index % 4
                }
            ]));
    }
    function business(id, typeId, ownerId) {
        return {
            businessId: id,
            ownerKind: "player",
            ownerId,
            typeId,
            name: businessLabels[typeId],
            status: "open",
            licenseClass: "basic trade",
            licenseLevel: 3,
            propertyId: "property_" + id,
            townId: "harthmere_grove",
            regionId: "harthmere_grove_region",
            inventory: inventory(),
            storageMaxSlots: 64,
            employees: [
                "employee_" + id
            ],
            activeContracts: [
                "active_contract_" + id
            ],
            completedContracts: 14,
            reputation: 32,
            customerSatisfaction: 84,
            sanitationRating: 72,
            safetyRating: 76,
            serviceRadius: 4,
            priceModifiers: {
                worker_meal: 1.2,
                repair_part: 1.1
            },
            balanceGold: 6200,
            debtGold: 0,
            upkeepGoldPerDay: 8,
            rentGoldPerDay: 6,
            wageGoldPerDay: 16,
            salesTaxRate: 0.06,
            lastTickAtMs: Date.now() - 6e4,
            createdAtMs: Date.now() - 864e5,
            updatedAtMs: Date.now(),
            flags: {}
        };
    }
    function buildSnapshot() {
        const businesses = {};
        const employees = {};
        const employeeCandidates = {};
        const employeeTaskRuns = {};
        const customerSessions = {};
        const customerStats = {};
        const openContracts = [];
        const activeContracts = [];
        for (const typeId of HARTHMERE_BUSINESS_TYPE_ORDER_V1){
            for (const mode of [
                "owner",
                "customer"
            ]){
                const id = mode + "_" + typeId;
                businesses[id] = business(id, typeId, mode === "owner" ? "player_a" : "player_b");
            }
            const ownerBusinessId = "owner_" + typeId;
            const employeeId = "employee_" + ownerBusinessId;
            employees[employeeId] = {
                employeeId,
                businessId: ownerBusinessId,
                npcId: "npc_" + typeId,
                role: "Floor Specialist",
                skill: 4,
                wageGoldPerDay: 16,
                morale: 72,
                loyalty: 66,
                assignedTask: "front_counter",
                hiredAtMs: 1,
                lastPaidAtMs: 1
            };
            employeeCandidates["candidate_" + typeId] = {
                candidateId: "candidate_" + typeId,
                businessId: ownerBusinessId,
                typeId,
                displayName: businessLabels[typeId] + " Helper",
                role: "Assistant",
                skill: 3,
                wageAskGoldPerDay: 18,
                personality: "steady",
                schedule: "flex",
                workplacePreference: "front counter",
                preferredTaskId: "front_counter",
                status: "available",
                negotiationRounds: 0,
                generatedAtMs: 1,
                expiresAtMs: Date.now() + 864e5,
                notes: []
            };
            const definition2 = getHarthmereBusinessMiniGameDefinitionV1(typeId);
            employeeTaskRuns["task_" + typeId] = {
                taskRunId: "task_" + typeId,
                businessId: ownerBusinessId,
                typeId,
                employeeId,
                employeeRole: "Floor Specialist",
                offerId: definition2.offers[0].offerId,
                offerLabel: definition2.offers[0].label,
                taskKind: "counter_service",
                status: "completed",
                animationFamily: "counter_handoff",
                employeePath: [
                    {
                        x: 1,
                        y: 1
                    },
                    {
                        x: 2,
                        y: 1
                    }
                ],
                createdAtMs: Date.now()
            };
            const ask = definition2.askTemplates[0];
            var _HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1_find;
            const npc = (_HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1_find = HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1.find((candidate)=>candidate.businessPreferences.includes(typeId))) !== null && _HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1_find !== void 0 ? _HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1_find : HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1[0];
            customerSessions["session_" + typeId] = {
                sessionId: "session_" + typeId,
                businessId: ownerBusinessId,
                typeId,
                actorId: "player_a",
                status: "active",
                startedAtMs: Date.now() - 1e4,
                expiresAtMs: Date.now() + 36e5,
                currentTicketId: "ticket_" + typeId,
                queue: [
                    {
                        ticketId: "ticket_" + typeId,
                        npcId: npc.npcId,
                        askId: ask.askId,
                        requestedOfferId: ask.desiredOfferId,
                        askLine: ask.line,
                        status: "waiting",
                        arrivedAtMs: Date.now() - 5e3,
                        patience: ask.patience,
                        patienceRemaining: ask.patience,
                        difficulty: ask.difficulty,
                        rewardGold: ask.rewardGold,
                        reputationDelta: ask.reputationDelta,
                        needDelta: ask.needDelta,
                        navGoal: ask.navGoal
                    }
                ],
                servedTicketIds: [],
                failedTicketIds: [],
                streak: 2,
                satisfaction: 72,
                earnedGold: 0,
                progressPoints: 0,
                dailyBonusGold: 18,
                notes: [
                    npc.displayName + " walked from queue to counter."
                ]
            };
            customerStats[ownerBusinessId] = {
                businessId: ownerBusinessId,
                totalServed: 64,
                totalFailed: 2,
                lifetimeGold: 2400,
                bestStreak: 8,
                currentTier: 3,
                serviceXp: 820,
                likeability: 34,
                friendshipPointsByNpcId: {
                    [npc.npcId]: 8
                },
                favoriteCustomerNpcIds: [
                    npc.npcId
                ],
                repeatCustomerMemories: [
                    npc.displayName + " remembers a fast counter visit."
                ],
                thankYouNotes: [
                    npc.displayName + " left a thank-you note."
                ],
                collectiblesEarned: [
                    typeId + " customer stamp"
                ],
                decorationUnlocks: [
                    typeId + " counter keepsake"
                ],
                badges: [
                    typeId + " trusted service"
                ]
            };
            openContracts.push({
                contractId: "open_" + typeId,
                issuerKind: "player",
                issuerId: "customer_a",
                title: businessLabels[typeId] + " request",
                businessType: typeId,
                requirements: [
                    {
                        serviceNeed: definition2.offers[0].serviceNeed,
                        serviceUnits: 1
                    }
                ],
                rewardGold: 120,
                reputationDelta: 2,
                status: "open",
                regionId: "harthmere_grove_region",
                createdAtMs: 1,
                deadlineAtMs: Date.now() + 864e5,
                failurePenaltyGold: 10,
                escrowGold: 120,
                logs: []
            });
            activeContracts.push({
                contractId: "active_" + typeId,
                issuerKind: "player",
                issuerId: "customer_b",
                title: businessLabels[typeId] + " active order",
                businessType: typeId,
                requirements: [
                    {
                        itemId: Object.keys(definition2.offers[0].requiredItems)[0],
                        count: 1
                    }
                ],
                rewardGold: 150,
                reputationDelta: 3,
                status: "active",
                acceptedByBusinessId: ownerBusinessId,
                acceptedByActorId: "player_a",
                regionId: "harthmere_grove_region",
                createdAtMs: 1,
                deadlineAtMs: Date.now() + 432e5,
                failurePenaltyGold: 15,
                escrowGold: 150,
                logs: []
            });
        }
        return normalizeHarthmereBusinessEconomySnapshotV1({
            actorId: "player_a",
            version: "business-interface-live-audit-v1",
            businessTypes: Object.fromEntries(HARTHMERE_BUSINESS_TYPE_ORDER_V1.map((typeId)=>[
                    typeId,
                    businessType(typeId)
                ])),
            businesses,
            myBusinesses: Object.values(businesses).filter((entry)=>entry.ownerId === "player_a"),
            openContracts,
            activeContracts,
            customerContracts: [],
            employees,
            loans: {},
            insurancePolicies: {},
            tradeRoutes: {},
            failures: {},
            marketOrders: {
                order_worker_meal: {
                    orderId: "order_worker_meal",
                    kind: "sell",
                    itemId: "worker_meal",
                    count: 4,
                    unitPriceGold: 28,
                    status: "open"
                }
            },
            towns: {
                harthmere_grove: {
                    townId: "harthmere_grove",
                    publicBudgetGold: 2e3,
                    needs: {}
                }
            },
            regions: {
                harthmere_grove_region: {
                    regionId: "harthmere_grove_region",
                    priceIndex: Object.fromEntries(allServiceItems.map((itemId, index)=>[
                            itemId,
                            10 + index % 7
                        ]))
                }
            },
            businessSystems: {
                permissions: {},
                bankAccounts: {},
                outpostBuildings: HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS_V1,
                empireBranches: {},
                branchDashboards: {},
                automationAssignments: {},
                employeeCandidates,
                employeeTaskRuns,
                customerSessions,
                customerStats,
                serviceQuests: {}
            },
            balanceWarnings: [],
            ledger: []
        });
    }
    var auditState = buildSnapshot();
    var operations = [];
    var adapter = createHarthmereBusinessInterfaceAdapterV1({
        state: auditState,
        hydrated: true,
        refresh: async ()=>auditState,
        submit: async (operation, payload)=>{
            operations.push({
                operation,
                payload
            });
            return {
                ok: true,
                economyState: auditState
            };
        }
    });
    function AuditApp() {
        const [typeId, setTypeId] = React4.useState("food_service_restaurant");
        const [mode, setMode] = React4.useState("owner");
        const activeBusinessId = mode + "_" + typeId;
        React4.useEffect(()=>{
            window.__businessAudit = {
                select: (nextTypeId, nextMode)=>{
                    setTypeId(nextTypeId);
                    setMode(nextMode);
                },
                operations,
                clearOperations: ()=>{
                    operations.splice(0, operations.length);
                },
                activeBusinessId: ()=>activeBusinessId,
                typeIds: HARTHMERE_BUSINESS_TYPE_ORDER_V1
            };
        }, [
            activeBusinessId
        ]);
        return /*#__PURE__*/ React4.createElement("main", null, /*#__PURE__*/ React4.createElement("div", {
            className: "audit-toolbar",
            "data-testid": "audit-toolbar"
        }, /*#__PURE__*/ React4.createElement("label", null, "Business ", /*#__PURE__*/ React4.createElement("select", {
            "aria-label": "Audit business",
            value: typeId,
            onChange: (event)=>setTypeId(event.currentTarget.value)
        }, HARTHMERE_BUSINESS_TYPE_ORDER_V1.map((id)=>/*#__PURE__*/ React4.createElement("option", {
                key: id,
                value: id
            }, businessLabels[id])))), /*#__PURE__*/ React4.createElement("button", {
            type: "button",
            "aria-pressed": mode === "owner",
            onClick: ()=>setMode("owner")
        }, "Owner"), /*#__PURE__*/ React4.createElement("button", {
            type: "button",
            "aria-pressed": mode === "customer",
            onClick: ()=>setMode("customer")
        }, "Customer"), /*#__PURE__*/ React4.createElement("span", null, businessLabels[typeId], " \xB7 ", mode)), /*#__PURE__*/ React4.createElement(HarthmereBusinessInterfacePanel, {
            adapter: adapter,
            nearbyBusinessId: activeBusinessId,
            context: {
                insideBusiness: true,
                nearbyBusinessId: activeBusinessId,
                actorGuildId: "guild_1"
            },
            compact: true
        }));
    }
    (0, import_client.createRoot)(document.getElementById("root")).render(/*#__PURE__*/ React4.createElement(AuditApp, null));
})();
