var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../../../../../opt/hostedtoolcache/node/20.20.2/x64/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/_internal/utils.mjs
// @__NO_SIDE_EFFECTS__
function createNotImplementedError(name) {
  return new Error(`[unenv] ${name} is not implemented yet!`);
}
__name(createNotImplementedError, "createNotImplementedError");
// @__NO_SIDE_EFFECTS__
function notImplemented(name) {
  const fn = /* @__PURE__ */ __name(() => {
    throw /* @__PURE__ */ createNotImplementedError(name);
  }, "fn");
  return Object.assign(fn, { __unenv__: true });
}
__name(notImplemented, "notImplemented");
// @__NO_SIDE_EFFECTS__
function notImplementedClass(name) {
  return class {
    __unenv__ = true;
    constructor() {
      throw new Error(`[unenv] ${name} is not implemented yet!`);
    }
  };
}
__name(notImplementedClass, "notImplementedClass");

// ../../../../../opt/hostedtoolcache/node/20.20.2/x64/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/perf_hooks/performance.mjs
var _timeOrigin = globalThis.performance?.timeOrigin ?? Date.now();
var _performanceNow = globalThis.performance?.now ? globalThis.performance.now.bind(globalThis.performance) : () => Date.now() - _timeOrigin;
var nodeTiming = {
  name: "node",
  entryType: "node",
  startTime: 0,
  duration: 0,
  nodeStart: 0,
  v8Start: 0,
  bootstrapComplete: 0,
  environment: 0,
  loopStart: 0,
  loopExit: 0,
  idleTime: 0,
  uvMetricsInfo: {
    loopCount: 0,
    events: 0,
    eventsWaiting: 0
  },
  detail: void 0,
  toJSON() {
    return this;
  }
};
var PerformanceEntry = class {
  static {
    __name(this, "PerformanceEntry");
  }
  __unenv__ = true;
  detail;
  entryType = "event";
  name;
  startTime;
  constructor(name, options) {
    this.name = name;
    this.startTime = options?.startTime || _performanceNow();
    this.detail = options?.detail;
  }
  get duration() {
    return _performanceNow() - this.startTime;
  }
  toJSON() {
    return {
      name: this.name,
      entryType: this.entryType,
      startTime: this.startTime,
      duration: this.duration,
      detail: this.detail
    };
  }
};
var PerformanceMark = class PerformanceMark2 extends PerformanceEntry {
  static {
    __name(this, "PerformanceMark");
  }
  entryType = "mark";
  constructor() {
    super(...arguments);
  }
  get duration() {
    return 0;
  }
};
var PerformanceMeasure = class extends PerformanceEntry {
  static {
    __name(this, "PerformanceMeasure");
  }
  entryType = "measure";
};
var PerformanceResourceTiming = class extends PerformanceEntry {
  static {
    __name(this, "PerformanceResourceTiming");
  }
  entryType = "resource";
  serverTiming = [];
  connectEnd = 0;
  connectStart = 0;
  decodedBodySize = 0;
  domainLookupEnd = 0;
  domainLookupStart = 0;
  encodedBodySize = 0;
  fetchStart = 0;
  initiatorType = "";
  name = "";
  nextHopProtocol = "";
  redirectEnd = 0;
  redirectStart = 0;
  requestStart = 0;
  responseEnd = 0;
  responseStart = 0;
  secureConnectionStart = 0;
  startTime = 0;
  transferSize = 0;
  workerStart = 0;
  responseStatus = 0;
};
var PerformanceObserverEntryList = class {
  static {
    __name(this, "PerformanceObserverEntryList");
  }
  __unenv__ = true;
  getEntries() {
    return [];
  }
  getEntriesByName(_name, _type) {
    return [];
  }
  getEntriesByType(type) {
    return [];
  }
};
var Performance = class {
  static {
    __name(this, "Performance");
  }
  __unenv__ = true;
  timeOrigin = _timeOrigin;
  eventCounts = /* @__PURE__ */ new Map();
  _entries = [];
  _resourceTimingBufferSize = 0;
  navigation = void 0;
  timing = void 0;
  timerify(_fn, _options) {
    throw createNotImplementedError("Performance.timerify");
  }
  get nodeTiming() {
    return nodeTiming;
  }
  eventLoopUtilization() {
    return {};
  }
  markResourceTiming() {
    return new PerformanceResourceTiming("");
  }
  onresourcetimingbufferfull = null;
  now() {
    if (this.timeOrigin === _timeOrigin) {
      return _performanceNow();
    }
    return Date.now() - this.timeOrigin;
  }
  clearMarks(markName) {
    this._entries = markName ? this._entries.filter((e) => e.name !== markName) : this._entries.filter((e) => e.entryType !== "mark");
  }
  clearMeasures(measureName) {
    this._entries = measureName ? this._entries.filter((e) => e.name !== measureName) : this._entries.filter((e) => e.entryType !== "measure");
  }
  clearResourceTimings() {
    this._entries = this._entries.filter((e) => e.entryType !== "resource" || e.entryType !== "navigation");
  }
  getEntries() {
    return this._entries;
  }
  getEntriesByName(name, type) {
    return this._entries.filter((e) => e.name === name && (!type || e.entryType === type));
  }
  getEntriesByType(type) {
    return this._entries.filter((e) => e.entryType === type);
  }
  mark(name, options) {
    const entry = new PerformanceMark(name, options);
    this._entries.push(entry);
    return entry;
  }
  measure(measureName, startOrMeasureOptions, endMark) {
    let start;
    let end;
    if (typeof startOrMeasureOptions === "string") {
      start = this.getEntriesByName(startOrMeasureOptions, "mark")[0]?.startTime;
      end = this.getEntriesByName(endMark, "mark")[0]?.startTime;
    } else {
      start = Number.parseFloat(startOrMeasureOptions?.start) || this.now();
      end = Number.parseFloat(startOrMeasureOptions?.end) || this.now();
    }
    const entry = new PerformanceMeasure(measureName, {
      startTime: start,
      detail: {
        start,
        end
      }
    });
    this._entries.push(entry);
    return entry;
  }
  setResourceTimingBufferSize(maxSize) {
    this._resourceTimingBufferSize = maxSize;
  }
  addEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.addEventListener");
  }
  removeEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.removeEventListener");
  }
  dispatchEvent(event) {
    throw createNotImplementedError("Performance.dispatchEvent");
  }
  toJSON() {
    return this;
  }
};
var PerformanceObserver = class {
  static {
    __name(this, "PerformanceObserver");
  }
  __unenv__ = true;
  static supportedEntryTypes = [];
  _callback = null;
  constructor(callback) {
    this._callback = callback;
  }
  takeRecords() {
    return [];
  }
  disconnect() {
    throw createNotImplementedError("PerformanceObserver.disconnect");
  }
  observe(options) {
    throw createNotImplementedError("PerformanceObserver.observe");
  }
  bind(fn) {
    return fn;
  }
  runInAsyncScope(fn, thisArg, ...args) {
    return fn.call(thisArg, ...args);
  }
  asyncId() {
    return 0;
  }
  triggerAsyncId() {
    return 0;
  }
  emitDestroy() {
    return this;
  }
};
var performance = globalThis.performance && "addEventListener" in globalThis.performance ? globalThis.performance : new Performance();

// ../../../../../opt/hostedtoolcache/node/20.20.2/x64/lib/node_modules/wrangler/node_modules/@cloudflare/unenv-preset/dist/runtime/polyfill/performance.mjs
if (!("__unenv__" in performance)) {
  const proto = Performance.prototype;
  for (const key of Object.getOwnPropertyNames(proto)) {
    if (key !== "constructor" && !(key in performance)) {
      const desc = Object.getOwnPropertyDescriptor(proto, key);
      if (desc) {
        Object.defineProperty(performance, key, desc);
      }
    }
  }
}
globalThis.performance = performance;
globalThis.Performance = Performance;
globalThis.PerformanceEntry = PerformanceEntry;
globalThis.PerformanceMark = PerformanceMark;
globalThis.PerformanceMeasure = PerformanceMeasure;
globalThis.PerformanceObserver = PerformanceObserver;
globalThis.PerformanceObserverEntryList = PerformanceObserverEntryList;
globalThis.PerformanceResourceTiming = PerformanceResourceTiming;

// ../../../../../opt/hostedtoolcache/node/20.20.2/x64/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/node/console.mjs
import { Writable } from "node:stream";

// ../../../../../opt/hostedtoolcache/node/20.20.2/x64/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/mock/noop.mjs
var noop_default = Object.assign(() => {
}, { __unenv__: true });

// ../../../../../opt/hostedtoolcache/node/20.20.2/x64/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/node/console.mjs
var _console = globalThis.console;
var _ignoreErrors = true;
var _stderr = new Writable();
var _stdout = new Writable();
var log = _console?.log ?? noop_default;
var info = _console?.info ?? log;
var trace = _console?.trace ?? info;
var debug = _console?.debug ?? log;
var table = _console?.table ?? log;
var error = _console?.error ?? log;
var warn = _console?.warn ?? error;
var createTask = _console?.createTask ?? /* @__PURE__ */ notImplemented("console.createTask");
var clear = _console?.clear ?? noop_default;
var count = _console?.count ?? noop_default;
var countReset = _console?.countReset ?? noop_default;
var dir = _console?.dir ?? noop_default;
var dirxml = _console?.dirxml ?? noop_default;
var group = _console?.group ?? noop_default;
var groupEnd = _console?.groupEnd ?? noop_default;
var groupCollapsed = _console?.groupCollapsed ?? noop_default;
var profile = _console?.profile ?? noop_default;
var profileEnd = _console?.profileEnd ?? noop_default;
var time = _console?.time ?? noop_default;
var timeEnd = _console?.timeEnd ?? noop_default;
var timeLog = _console?.timeLog ?? noop_default;
var timeStamp = _console?.timeStamp ?? noop_default;
var Console = _console?.Console ?? /* @__PURE__ */ notImplementedClass("console.Console");
var _times = /* @__PURE__ */ new Map();
var _stdoutErrorHandler = noop_default;
var _stderrErrorHandler = noop_default;

// ../../../../../opt/hostedtoolcache/node/20.20.2/x64/lib/node_modules/wrangler/node_modules/@cloudflare/unenv-preset/dist/runtime/node/console.mjs
var workerdConsole = globalThis["console"];
var {
  assert,
  clear: clear2,
  // @ts-expect-error undocumented public API
  context,
  count: count2,
  countReset: countReset2,
  // @ts-expect-error undocumented public API
  createTask: createTask2,
  debug: debug2,
  dir: dir2,
  dirxml: dirxml2,
  error: error2,
  group: group2,
  groupCollapsed: groupCollapsed2,
  groupEnd: groupEnd2,
  info: info2,
  log: log2,
  profile: profile2,
  profileEnd: profileEnd2,
  table: table2,
  time: time2,
  timeEnd: timeEnd2,
  timeLog: timeLog2,
  timeStamp: timeStamp2,
  trace: trace2,
  warn: warn2
} = workerdConsole;
Object.assign(workerdConsole, {
  Console,
  _ignoreErrors,
  _stderr,
  _stderrErrorHandler,
  _stdout,
  _stdoutErrorHandler,
  _times
});
var console_default = workerdConsole;

// ../../../../../opt/hostedtoolcache/node/20.20.2/x64/lib/node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-console
globalThis.console = console_default;

// ../../../../../opt/hostedtoolcache/node/20.20.2/x64/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/process/hrtime.mjs
var hrtime = /* @__PURE__ */ Object.assign(/* @__PURE__ */ __name(function hrtime2(startTime) {
  const now = Date.now();
  const seconds = Math.trunc(now / 1e3);
  const nanos = now % 1e3 * 1e6;
  if (startTime) {
    let diffSeconds = seconds - startTime[0];
    let diffNanos = nanos - startTime[0];
    if (diffNanos < 0) {
      diffSeconds = diffSeconds - 1;
      diffNanos = 1e9 + diffNanos;
    }
    return [diffSeconds, diffNanos];
  }
  return [seconds, nanos];
}, "hrtime"), { bigint: /* @__PURE__ */ __name(function bigint() {
  return BigInt(Date.now() * 1e6);
}, "bigint") });

// ../../../../../opt/hostedtoolcache/node/20.20.2/x64/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/process/process.mjs
import { EventEmitter } from "node:events";

// ../../../../../opt/hostedtoolcache/node/20.20.2/x64/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/tty/read-stream.mjs
var ReadStream = class {
  static {
    __name(this, "ReadStream");
  }
  fd;
  isRaw = false;
  isTTY = false;
  constructor(fd) {
    this.fd = fd;
  }
  setRawMode(mode) {
    this.isRaw = mode;
    return this;
  }
};

// ../../../../../opt/hostedtoolcache/node/20.20.2/x64/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/tty/write-stream.mjs
var WriteStream = class {
  static {
    __name(this, "WriteStream");
  }
  fd;
  columns = 80;
  rows = 24;
  isTTY = false;
  constructor(fd) {
    this.fd = fd;
  }
  clearLine(dir3, callback) {
    callback && callback();
    return false;
  }
  clearScreenDown(callback) {
    callback && callback();
    return false;
  }
  cursorTo(x, y, callback) {
    callback && typeof callback === "function" && callback();
    return false;
  }
  moveCursor(dx, dy, callback) {
    callback && callback();
    return false;
  }
  getColorDepth(env2) {
    return 1;
  }
  hasColors(count3, env2) {
    return false;
  }
  getWindowSize() {
    return [this.columns, this.rows];
  }
  write(str, encoding, cb) {
    if (str instanceof Uint8Array) {
      str = new TextDecoder().decode(str);
    }
    try {
      console.log(str);
    } catch {
    }
    cb && typeof cb === "function" && cb();
    return false;
  }
};

// ../../../../../opt/hostedtoolcache/node/20.20.2/x64/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/process/node-version.mjs
var NODE_VERSION = "22.14.0";

// ../../../../../opt/hostedtoolcache/node/20.20.2/x64/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/process/process.mjs
var Process = class _Process extends EventEmitter {
  static {
    __name(this, "Process");
  }
  env;
  hrtime;
  nextTick;
  constructor(impl) {
    super();
    this.env = impl.env;
    this.hrtime = impl.hrtime;
    this.nextTick = impl.nextTick;
    for (const prop of [...Object.getOwnPropertyNames(_Process.prototype), ...Object.getOwnPropertyNames(EventEmitter.prototype)]) {
      const value = this[prop];
      if (typeof value === "function") {
        this[prop] = value.bind(this);
      }
    }
  }
  // --- event emitter ---
  emitWarning(warning, type, code) {
    console.warn(`${code ? `[${code}] ` : ""}${type ? `${type}: ` : ""}${warning}`);
  }
  emit(...args) {
    return super.emit(...args);
  }
  listeners(eventName) {
    return super.listeners(eventName);
  }
  // --- stdio (lazy initializers) ---
  #stdin;
  #stdout;
  #stderr;
  get stdin() {
    return this.#stdin ??= new ReadStream(0);
  }
  get stdout() {
    return this.#stdout ??= new WriteStream(1);
  }
  get stderr() {
    return this.#stderr ??= new WriteStream(2);
  }
  // --- cwd ---
  #cwd = "/";
  chdir(cwd2) {
    this.#cwd = cwd2;
  }
  cwd() {
    return this.#cwd;
  }
  // --- dummy props and getters ---
  arch = "";
  platform = "";
  argv = [];
  argv0 = "";
  execArgv = [];
  execPath = "";
  title = "";
  pid = 200;
  ppid = 100;
  get version() {
    return `v${NODE_VERSION}`;
  }
  get versions() {
    return { node: NODE_VERSION };
  }
  get allowedNodeEnvironmentFlags() {
    return /* @__PURE__ */ new Set();
  }
  get sourceMapsEnabled() {
    return false;
  }
  get debugPort() {
    return 0;
  }
  get throwDeprecation() {
    return false;
  }
  get traceDeprecation() {
    return false;
  }
  get features() {
    return {};
  }
  get release() {
    return {};
  }
  get connected() {
    return false;
  }
  get config() {
    return {};
  }
  get moduleLoadList() {
    return [];
  }
  constrainedMemory() {
    return 0;
  }
  availableMemory() {
    return 0;
  }
  uptime() {
    return 0;
  }
  resourceUsage() {
    return {};
  }
  // --- noop methods ---
  ref() {
  }
  unref() {
  }
  // --- unimplemented methods ---
  umask() {
    throw createNotImplementedError("process.umask");
  }
  getBuiltinModule() {
    return void 0;
  }
  getActiveResourcesInfo() {
    throw createNotImplementedError("process.getActiveResourcesInfo");
  }
  exit() {
    throw createNotImplementedError("process.exit");
  }
  reallyExit() {
    throw createNotImplementedError("process.reallyExit");
  }
  kill() {
    throw createNotImplementedError("process.kill");
  }
  abort() {
    throw createNotImplementedError("process.abort");
  }
  dlopen() {
    throw createNotImplementedError("process.dlopen");
  }
  setSourceMapsEnabled() {
    throw createNotImplementedError("process.setSourceMapsEnabled");
  }
  loadEnvFile() {
    throw createNotImplementedError("process.loadEnvFile");
  }
  disconnect() {
    throw createNotImplementedError("process.disconnect");
  }
  cpuUsage() {
    throw createNotImplementedError("process.cpuUsage");
  }
  setUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.setUncaughtExceptionCaptureCallback");
  }
  hasUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.hasUncaughtExceptionCaptureCallback");
  }
  initgroups() {
    throw createNotImplementedError("process.initgroups");
  }
  openStdin() {
    throw createNotImplementedError("process.openStdin");
  }
  assert() {
    throw createNotImplementedError("process.assert");
  }
  binding() {
    throw createNotImplementedError("process.binding");
  }
  // --- attached interfaces ---
  permission = { has: /* @__PURE__ */ notImplemented("process.permission.has") };
  report = {
    directory: "",
    filename: "",
    signal: "SIGUSR2",
    compact: false,
    reportOnFatalError: false,
    reportOnSignal: false,
    reportOnUncaughtException: false,
    getReport: /* @__PURE__ */ notImplemented("process.report.getReport"),
    writeReport: /* @__PURE__ */ notImplemented("process.report.writeReport")
  };
  finalization = {
    register: /* @__PURE__ */ notImplemented("process.finalization.register"),
    unregister: /* @__PURE__ */ notImplemented("process.finalization.unregister"),
    registerBeforeExit: /* @__PURE__ */ notImplemented("process.finalization.registerBeforeExit")
  };
  memoryUsage = Object.assign(() => ({
    arrayBuffers: 0,
    rss: 0,
    external: 0,
    heapTotal: 0,
    heapUsed: 0
  }), { rss: /* @__PURE__ */ __name(() => 0, "rss") });
  // --- undefined props ---
  mainModule = void 0;
  domain = void 0;
  // optional
  send = void 0;
  exitCode = void 0;
  channel = void 0;
  getegid = void 0;
  geteuid = void 0;
  getgid = void 0;
  getgroups = void 0;
  getuid = void 0;
  setegid = void 0;
  seteuid = void 0;
  setgid = void 0;
  setgroups = void 0;
  setuid = void 0;
  // internals
  _events = void 0;
  _eventsCount = void 0;
  _exiting = void 0;
  _maxListeners = void 0;
  _debugEnd = void 0;
  _debugProcess = void 0;
  _fatalException = void 0;
  _getActiveHandles = void 0;
  _getActiveRequests = void 0;
  _kill = void 0;
  _preload_modules = void 0;
  _rawDebug = void 0;
  _startProfilerIdleNotifier = void 0;
  _stopProfilerIdleNotifier = void 0;
  _tickCallback = void 0;
  _disconnect = void 0;
  _handleQueue = void 0;
  _pendingMessage = void 0;
  _channel = void 0;
  _send = void 0;
  _linkedBinding = void 0;
};

// ../../../../../opt/hostedtoolcache/node/20.20.2/x64/lib/node_modules/wrangler/node_modules/@cloudflare/unenv-preset/dist/runtime/node/process.mjs
var globalProcess = globalThis["process"];
var getBuiltinModule = globalProcess.getBuiltinModule;
var workerdProcess = getBuiltinModule("node:process");
var unenvProcess = new Process({
  env: globalProcess.env,
  hrtime,
  // `nextTick` is available from workerd process v1
  nextTick: workerdProcess.nextTick
});
var { exit, features, platform } = workerdProcess;
var {
  _channel,
  _debugEnd,
  _debugProcess,
  _disconnect,
  _events,
  _eventsCount,
  _exiting,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _handleQueue,
  _kill,
  _linkedBinding,
  _maxListeners,
  _pendingMessage,
  _preload_modules,
  _rawDebug,
  _send,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  arch,
  argv,
  argv0,
  assert: assert2,
  availableMemory,
  binding,
  channel,
  chdir,
  config,
  connected,
  constrainedMemory,
  cpuUsage,
  cwd,
  debugPort,
  disconnect,
  dlopen,
  domain,
  emit,
  emitWarning,
  env,
  eventNames,
  execArgv,
  execPath,
  exitCode,
  finalization,
  getActiveResourcesInfo,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getMaxListeners,
  getuid,
  hasUncaughtExceptionCaptureCallback,
  hrtime: hrtime3,
  initgroups,
  kill,
  listenerCount,
  listeners,
  loadEnvFile,
  mainModule,
  memoryUsage,
  moduleLoadList,
  nextTick,
  off,
  on,
  once,
  openStdin,
  permission,
  pid,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  reallyExit,
  ref,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  send,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setMaxListeners,
  setSourceMapsEnabled,
  setuid,
  setUncaughtExceptionCaptureCallback,
  sourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  throwDeprecation,
  title,
  traceDeprecation,
  umask,
  unref,
  uptime,
  version,
  versions
} = unenvProcess;
var _process = {
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  hasUncaughtExceptionCaptureCallback,
  setUncaughtExceptionCaptureCallback,
  loadEnvFile,
  sourceMapsEnabled,
  arch,
  argv,
  argv0,
  chdir,
  config,
  connected,
  constrainedMemory,
  availableMemory,
  cpuUsage,
  cwd,
  debugPort,
  dlopen,
  disconnect,
  emit,
  emitWarning,
  env,
  eventNames,
  execArgv,
  execPath,
  exit,
  finalization,
  features,
  getBuiltinModule,
  getActiveResourcesInfo,
  getMaxListeners,
  hrtime: hrtime3,
  kill,
  listeners,
  listenerCount,
  memoryUsage,
  nextTick,
  on,
  off,
  once,
  pid,
  platform,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  setMaxListeners,
  setSourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  title,
  throwDeprecation,
  traceDeprecation,
  umask,
  uptime,
  version,
  versions,
  // @ts-expect-error old API
  domain,
  initgroups,
  moduleLoadList,
  reallyExit,
  openStdin,
  assert: assert2,
  binding,
  send,
  exitCode,
  channel,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getuid,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setuid,
  permission,
  mainModule,
  _events,
  _eventsCount,
  _exiting,
  _maxListeners,
  _debugEnd,
  _debugProcess,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _kill,
  _preload_modules,
  _rawDebug,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  _disconnect,
  _handleQueue,
  _pendingMessage,
  _channel,
  _send,
  _linkedBinding
};
var process_default = _process;

// ../../../../../opt/hostedtoolcache/node/20.20.2/x64/lib/node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-process
globalThis.process = process_default;

// worker.js
var CURRENT_VERSION = "3.3-multiuser-dns";
var OPTIMIZED_DOMAINS = [
  { subdomain: "", domain: "cf.090227.xyz", name: "CF\u4F18\u9009-090227" },
  { subdomain: "", domain: "cf.877774.xyz", name: "CF\u4F18\u9009-877774" },
  { subdomain: "", domain: "cloudflare-dl.byoip.top", name: "\u9C7C\u76AE\u4F18\u9009" },
  { subdomain: "", domain: "saas.sin.fan", name: "MIYU\u4F18\u9009" },
  { subdomain: "", domain: "bestcf.030101.xyz", name: "Mingyu\u4F18\u9009" },
  { subdomain: "", domain: "cf.cloudflare.182682.xyz", name: "WeTest\u4F18\u9009" },
  { subdomain: "", domain: "cf.tencentapp.cn", name: "\u65E0\u540D\u6C0F\u7EF4\u62A4" },
  { subdomain: "", domain: "www.visa.cn", name: "Visa\u5B98\u65B9" },
  { subdomain: "", domain: "mfa.gov.ua", name: "\u4E4C\u514B\u5170\u5916\u4EA4\u90E8" },
  { subdomain: "", domain: "www.shopify.com", name: "Shopify\u5B98\u65B9" },
  { subdomain: "", domain: "store.ubi.com", name: "\u80B2\u78A7\u5546\u5E97" },
  { subdomain: "", domain: "staticdelivery.nexusmods.com", name: "NexusMods" }
];
var RESERVED_ALIASES = /* @__PURE__ */ new Set([
  "admin",
  "stats",
  "health",
  "api",
  "favicon.ico",
  "cdn-cgi",
  "__client_rtt__",
  "web",
  "emby",
  "sessions",
  "playbackinfo"
]);
var MANUAL_REDIRECT_DOMAINS = [
  "emby.bangumi.ca",
  "aliyundrive.com",
  "aliyundrive.net",
  "aliyuncs.com",
  "alicdn.com",
  "aliyun.com",
  "cdn.aliyundrive.com",
  "xunlei.com",
  "xlusercdn.com",
  "xycdn.com",
  "sandai.net",
  "thundercdn.com",
  "115.com",
  "115cdn.com",
  "115cdn.net",
  "anxia.com",
  "189.cn",
  "mini189.cn",
  "ctyunxs.cn",
  "cloud.189.cn",
  "tianyiyun.com",
  "telecomjs.com",
  "quark.cn",
  "quarkdrive.cn",
  "uc.cn",
  "ucdrive.cn",
  "xiaoya.pro",
  "myqcloud.com",
  "cloudfront.net",
  "akamaized.net",
  "fastly.net",
  "hwcdn.net",
  "bytecdn.cn",
  "bdcdn.net"
];
var DOMAIN_PROXY_RULES = { "biliblili.uk": "example.com" };
var JP_COLOS = ["NRT", "KIX", "FUK", "OKA"];
var blocker = {
  keys: [".m3u8", ".ts", ".acc", ".m4s", "photocall.tv", "googlevideo.com"],
  check(url) {
    url = url.toLowerCase();
    return blocker.keys.some((x) => url.includes(x));
  }
};
var CONFIG = {
  pikpakProxyUrl: "https://pp.255432.xyz",
  enableStats: true,
  cacheEnabled: true,
  domainCacheTtlMs: 36e5
};
var DEFAULT_PREFERRED_HOST = "youxuan.cf.090227.xyz";
var PIKPAK_DOMAINS = [
  "pikpak.com",
  "pikpak.net",
  "pikpak-cn.com",
  "pikpakcdn.com",
  "pikpakapi.com",
  "pikpakdrive.com"
];
var CORS_JSON = { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" };
var dbReady = false;
var DATABASE_TABLES = [
  "routes",
  "visitor_logs",
  "request_stats",
  "auto_emby_daily_stats",
  "domain_speed_cache",
  "domain_best_cache",
  "user_domains",
  "invite_codes",
  "users"
];
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS_JSON });
}
__name(json, "json");
function html(body, status = 200) {
  return new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
__name(html, "html");
function getCookie(req, name) {
  const s = req.headers.get("Cookie");
  if (!s) return null;
  const m = s.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : null;
}
__name(getCookie, "getCookie");
function getAdminCredUser(env2) {
  const u = String(env2.ADMIN_USERNAME ?? env2.AdminUsername ?? "").trim().toLowerCase();
  return u || null;
}
__name(getAdminCredUser, "getAdminCredUser");
function getAdminCredPass(env2) {
  const p = String(env2.ADMIN_PASSWORD ?? env2.AdminPassword ?? "").trim();
  return p || null;
}
__name(getAdminCredPass, "getAdminCredPass");
function getAdminUsers(env2) {
  return String(env2.ADMIN_USERS || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
}
__name(getAdminUsers, "getAdminUsers");
function normalizeConfiguredDomain(value) {
  return String(value || "").trim().toLowerCase().replace(/\.+$/, "");
}
__name(normalizeConfiguredDomain, "normalizeConfiguredDomain");
function getDomainConfig(env2) {
  const publicEntryDomain = normalizeConfiguredDomain(env2.BASE_DOMAIN);
  const labels = publicEntryDomain.split(".").filter(Boolean);
  const userBaseDomain = labels.length >= 3 ? labels.slice(1).join(".") : publicEntryDomain;
  return { publicEntryDomain, userBaseDomain };
}
__name(getDomainConfig, "getDomainConfig");
function getBaseDomain(env2) {
  return getDomainConfig(env2).userBaseDomain;
}
__name(getBaseDomain, "getBaseDomain");
function isDnsLabel(value) {
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(String(value || ""));
}
__name(isDnsLabel, "isDnsLabel");
function isIpv4(value) {
  const parts = String(value || "").split(".");
  return parts.length === 4 && parts.every((part) => /^\d+$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
}
__name(isIpv4, "isIpv4");
function isIpv6(value) {
  return String(value || "").includes(":") && /^[0-9a-f:]+$/i.test(String(value || ""));
}
__name(isIpv6, "isIpv6");
function normalizeDnsTarget(value) {
  let target = String(value || "").trim();
  if (!target) return null;
  try {
    if (/^https?:\/\//i.test(target)) target = new URL(target).hostname;
  } catch (_) {
    return null;
  }
  target = target.replace(/\.+$/, "").toLowerCase();
  if (!target || /[/?#:@]/.test(target) || target.length > 253) return null;
  if (isIpv4(target) || isIpv6(target)) return target;
  const labels = target.split(".");
  if (labels.length < 2 || labels.some((label) => !isDnsLabel(label))) return null;
  return target;
}
__name(normalizeDnsTarget, "normalizeDnsTarget");
function dnsRecordType(target) {
  if (isIpv4(target)) return "A";
  if (isIpv6(target)) return "AAAA";
  return "CNAME";
}
__name(dnsRecordType, "dnsRecordType");
function getDnsConfig(env2) {
  return {
    zoneId: String(env2.CF_ZONE_ID || "").trim(),
    token: String(env2.CF_DNS_API_TOKEN || env2.CF_API_TOKEN || "").trim()
  };
}
__name(getDnsConfig, "getDnsConfig");
async function cloudflareDnsRequest(env2, path, init = {}) {
  const { zoneId, token } = getDnsConfig(env2);
  if (!zoneId || !token) throw new Error("DNS \u672A\u914D\u7F6E\uFF1A\u8BF7\u8BBE\u7F6E CF_DNS_API_TOKEN \u548C CF_ZONE_ID");
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}${path}`, { ...init, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    const message = data.errors?.map((x) => x.message).join("; ") || `Cloudflare API HTTP ${response.status}`;
    throw new Error(message);
  }
  return data;
}
__name(cloudflareDnsRequest, "cloudflareDnsRequest");
async function listUserDnsRecords(env2, fullName) {
  const records = [];
  for (const type of ["A", "AAAA", "CNAME"]) {
    const data = await cloudflareDnsRequest(env2, `/dns_records?type=${type}&name=${encodeURIComponent(fullName)}&per_page=100`);
    records.push(...data.result || []);
  }
  return records;
}
__name(listUserDnsRecords, "listUserDnsRecords");
async function deleteUserDnsRecords(env2, subdomain) {
  const fullName = `${subdomain}.${getBaseDomain(env2)}`;
  const records = await listUserDnsRecords(env2, fullName);
  for (const record of records) {
    await cloudflareDnsRequest(env2, `/dns_records/${record.id}`, { method: "DELETE" });
  }
  return records.length;
}
__name(deleteUserDnsRecords, "deleteUserDnsRecords");
async function replaceUserDnsRecord(env2, subdomain, target) {
  const normalizedTarget = normalizeDnsTarget(target);
  if (!normalizedTarget) throw new Error("\u4F18\u9009\u76EE\u6807\u5FC5\u987B\u662F\u5408\u6CD5\u57DF\u540D\u6216 IP");
  const fullName = `${subdomain}.${getBaseDomain(env2)}`;
  await deleteUserDnsRecords(env2, subdomain);
  const type = dnsRecordType(normalizedTarget);
  const data = await cloudflareDnsRequest(env2, "/dns_records", {
    method: "POST",
    body: JSON.stringify({
      type,
      name: fullName,
      content: normalizedTarget,
      ttl: 1,
      proxied: false

    })
  });
  return { host: normalizedTarget, type, name: fullName, recordId: data.result?.id || "" };
}
__name(replaceUserDnsRecord, "replaceUserDnsRecord");
function isAdminCookie(request, env2) {
  const provided = getCookie(request, "admin_token");
  if (!provided) return false;
  const adminPass = getAdminCredPass(env2);
  if (adminPass && provided === adminPass) return true;
  return false;
}
__name(isAdminCookie, "isAdminCookie");
async function hasAdminAccess(request, env2) {
  if (isAdminCookie(request, env2)) return true;
  if (env2.DB) {
    const u = await getUser(request, env2);
    if (u && u.role === "admin") return true;
  }
  return false;
}
__name(hasAdminAccess, "hasAdminAccess");
function adminLoginResponse(request, env2, username, password) {
  const adminUser = getAdminCredUser(env2);
  const adminPass = getAdminCredPass(env2);
  if (!adminUser || !adminPass) {
    return json({
      ok: false,
      error: "Worker \u672A\u914D\u7F6E ADMIN_USERNAME / ADMIN_PASSWORD\u3002\u8BF7\u5728 Cloudflare \u63A7\u5236\u53F0 \u2192 Worker \u2192 \u8BBE\u7F6E \u2192 \u53D8\u91CF\u548C\u673A\u5BC6 \u4E2D\u6DFB\u52A0\u3002"
    }, 503);
  }
  if (username !== adminUser || password !== adminPass) {
    return json({ ok: false, error: "\u7528\u6237\u540D\u6216\u5BC6\u7801\u9519\u8BEF" }, 401);
  }
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  const cookie = `admin_token=${encodeURIComponent(adminPass)}; Path=/; Max-Age=2592000; SameSite=Lax${secure}`;
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Set-Cookie": cookie,
      "Cache-Control": "no-store"
    }
  });
}
__name(adminLoginResponse, "adminLoginResponse");
var SESSION_TTL = 30 * 24 * 3600;
var RESERVED_SUBDOMAINS = ["admin", "api", "www", "user", "login", "register", "static", "cdn", "mail", "stats", "health", "cdn-cgi", "assets"];
function getSessionSecret(env2) {
  return String(env2.SESSION_SECRET || env2.ADMIN_TOKEN || "changeme-session-secret");
}
__name(getSessionSecret, "getSessionSecret");
function bufToHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(bufToHex, "bufToHex");
function hexToBuf(hex) {
  const a = new Uint8Array(hex.length / 2);
  for (let i = 0; i < a.length; i++) a[i] = parseInt(hex.substr(i * 2, 2), 16);
  return a.buffer;
}
__name(hexToBuf, "hexToBuf");
var TE = new TextEncoder();
async function hashPassword(pw, salt) {
  const algorithm = { name: "PBKDF2", hash: "SHA-256" };
  const key = await crypto.subtle.importKey("raw", TE.encode(pw), algorithm, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ ...algorithm, salt: hexToBuf(salt), iterations: 1e5 }, key, 256);
  return bufToHex(bits);
}
__name(hashPassword, "hashPassword");
function genSalt() {
  return bufToHex(crypto.getRandomValues(new Uint8Array(16)));
}
__name(genSalt, "genSalt");
function genInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const rnd = crypto.getRandomValues(new Uint8Array(32));
  let s = "";
  for (let i = 0; i < 32; i++) s += chars[rnd[i] % chars.length];
  return s;
}
__name(genInviteCode, "genInviteCode");
async function signHmac(payload, env2) {
  const algorithm = { name: "HMAC", hash: "SHA-256" };
  const key = await crypto.subtle.importKey("raw", TE.encode(getSessionSecret(env2)), algorithm, false, ["sign"]);
  return bufToHex(await crypto.subtle.sign(algorithm, key, TE.encode(payload)));
}
__name(signHmac, "signHmac");
async function signSession(userId, env2) {
  const exp = Date.now() + SESSION_TTL * 1e3;
  const payload = userId + ":" + exp;
  return payload + "." + await signHmac(payload, env2);
}
__name(signSession, "signSession");
function setSessionCookie(value) {
  return `user_token=${value}; Path=/; Max-Age=${SESSION_TTL}; SameSite=Lax; Secure`;
}
__name(setSessionCookie, "setSessionCookie");
async function getUser(request, env2) {
  const token = getCookie(request, "user_token");
  if (!token || !token.includes(".")) return null;
  const idx = token.lastIndexOf(".");
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const parts = payload.split(":");
  if (!parts[0] || !parts[1] || Date.now() > Number(parts[1])) return null;
  if (await signHmac(payload, env2) !== sig) return null;
  if (!env2.DB) return null;
  const u = await env2.DB.prepare("SELECT id, username, role, status FROM users WHERE id = ?").bind(Number(parts[0])).first();
  return u && u.status === "active" ? u : null;
}
__name(getUser, "getUser");
function buildRegisterHtml() {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>\u6CE8\u518C\u8D26\u53F7</title>${HEAD_LINK}<style>${PAGE_STYLE}
body{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px;}
.login-box{position:relative;background:linear-gradient(170deg,rgba(13,20,40,.95),rgba(7,11,22,.97));padding:38px 34px 30px;border-radius:4px;max-width:400px;width:100%;border:1px solid var(--line);box-shadow:0 30px 80px rgba(0,0,0,.6),0 0 80px rgba(0,229,255,.06);animation:riseIn .5s ease backwards;}
.login-box::before,.login-box::after{content:'';position:absolute;width:26px;height:26px;border:1px solid var(--cyan);}
.login-box::before{top:-1px;left:-1px;border-right:none;border-bottom:none;}
.login-box::after{bottom:-1px;right:-1px;border-left:none;border-top:none;}
.login-box input{display:block;width:100%;box-sizing:border-box;margin-bottom:14px;}
.hint{color:var(--dim);font-size:12px;margin:0 0 12px;padding:8px 12px;background:rgba(0,229,255,.06);border:1px solid rgba(0,229,255,.15);border-radius:3px;font-family:var(--fm);}
@media(max-width:480px){.login-box{padding:30px 22px 24px;}}
</style></head><body><div class="scanline"></div><div class="login-box">
<div class="brand-mark" style="margin:0 auto 20px"></div>
<h1 class="login-title">\u6CE8\u518C\u8D26\u53F7</h1>
<p class="login-sub">New Account Registration</p>
<input type="text" id="regUser" placeholder="\u7528\u6237\u540D\uFF083-32\u4F4D\u5C0F\u5199\u5B57\u6BCD\u3001\u6570\u5B57\u6216\u8FDE\u5B57\u7B26\uFF09" autocomplete="username" onkeydown="if(event.key==='Enter')doReg()">
<input type="password" id="regPass" placeholder="\u5BC6\u7801\uFF08\u81F3\u5C116\u4F4D\uFF09" autocomplete="new-password" onkeydown="if(event.key==='Enter')doReg()">
<input type="text" id="regCode" placeholder="\u9080\u8BF7\u7801\uFF08\u5411\u7BA1\u7406\u5458\u83B7\u53D6\uFF09" onkeydown="if(event.key==='Enter')doReg()">
<p id="regErr" class="login-err"></p>
<button class="btn" style="width:100%" id="regBtn" onclick="doReg()">\u6CE8\u518C\u5E76\u767B\u5F55</button>
<p class="login-link"><a href="/admin">\u7BA1\u7406\u5458\u767B\u5F55</a></p>
<script>
async function doReg(){
  var u=document.getElementById('regUser').value.trim();
  var p=document.getElementById('regPass').value;
  var c=document.getElementById('regCode').value.trim();
  var err=document.getElementById('regErr');
  err.textContent='';
  if(!u||!p||!c){err.textContent='\u8BF7\u586B\u5199\u5B8C\u6574';return;}
  document.getElementById('regBtn').disabled=true;
  try{
    var r=await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p,invite_code:c})});
    var text=await r.text();
    var d;
    try{d=JSON.parse(text);}catch(parseError){
      var detail=text.replace(/<[^>]*>/g,' ').replace(/s+/g,' ').trim().slice(0,160);
      throw new Error('\u670D\u52A1\u5668\u8FD4\u56DE\u4E86\u975E JSON\uFF08HTTP '+r.status+'\uFF09'+(detail?': '+detail:''));
    }
    if(d.ok){location.href='/admin';return;}
    err.textContent=d.error||'\u6CE8\u518C\u5931\u8D25';
  }catch(e){err.textContent='\u8BF7\u6C42\u5931\u8D25:'+e.message;}
  document.getElementById('regBtn').disabled=false;
}
<\/script></div></body></html>`;
}
__name(buildRegisterHtml, "buildRegisterHtml");
function buildUserHtml(u, env2) {
  const baseDomain = getBaseDomain(env2);
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>\u6211\u7684\u540E\u53F0</title>${HEAD_LINK}<style>${PAGE_STYLE}</style></head><body>
<div class="scanline"></div>
<div id="toast"></div>
<div class="container">
  <div class="card">
    <div class="page-hero">
      <div class="brand">
        <div class="brand-mark"></div>
        <div>
          <div class="brand-name">\u7528\u6237\u63A7\u5236\u53F0<span class="badge">${u.role === "admin" ? "ADMIN" : "USER"}</span></div>
          <div class="brand-sub">${u.username} \xB7 Edge Subdomain Manager</div>
        </div>
      </div>
      <div style="display:flex;gap:10px"><a href="/" class="btn btn-outline btn-sm">\u9996\u9875</a><button class="btn btn-del btn-sm" onclick="doLogout()">\u9000\u51FA</button></div>
    </div>
  </div>
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:12px">
      <h2 style="border:none;margin:0;padding:0;flex:1">\u6211\u7684\u8BBF\u95EE\u57DF\u540D<span class="h2-en" style="float:none;margin-left:12px">MY DOMAIN</span></h2>
    </div>
    <p class="muted" style="margin:0 0 14px">\u6CE8\u518C\u540E\u81EA\u52A8\u751F\u6210 <code>${u.username}.${baseDomain}</code>\uFF0C\u9ED8\u8BA4\u6307\u5411 <code>${DEFAULT_PREFERRED_HOST}</code>\u3002\u4F60\u53EF\u4EE5\u4FEE\u6539\u4F18\u9009\u57DF\u540D\u6216 IP\u3002</p>
    <div id="domainList" class="route-grid"><p class="muted">LOADING...</p></div>
  </div>

  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:16px">
      <h2 style="border:none;margin:0;padding:0;flex:1">\u6211\u7684\u8DEF\u7531<span class="h2-en" style="float:none;margin-left:12px">ROUTES</span></h2>
      <div class="toolbar" style="margin:0">
        <button class="btn" onclick="openUserRouteModal()">\u6DFB\u52A0\u8DEF\u7531</button>
        <div class="search-box">
          <span class="search-icon">\u2315</span>
          <input type="text" id="userRouteSearch" placeholder="\u641C\u7D22\u5907\u6CE8\u6216\u8DEF\u5F84..." oninput="filterUserRoutes()">
        </div>
      </div>
    </div>
    <p class="muted" style="margin:0 0 14px">\u8DEF\u7531\u53EF\u901A\u8FC7 <code>https://${u.username}.${baseDomain}/\u8DEF\u5F84</code> \u8BBF\u95EE\uFF0C\u540C\u4E00\u4E2A\u8D26\u53F7\u5185\u8DEF\u5F84\u4E0D\u80FD\u91CD\u590D\u3002</p>
    <div id="userRouteList" class="route-grid"><p class="muted">LOADING...</p></div>
  </div>
</div>
<div id="modalDomain" class="modal"><div class="modal-inner">
  <div class="modal-header"><h2 class="modal-title">\u4FEE\u6539\u8BBF\u95EE\u57DF\u540D</h2><p class="modal-desc">\u7ED1\u5B9A\u4F60\u7684\u4E09\u7EA7\u5B50\u57DF\u540D\u5230\u4F18\u9009\u57DF\u540D\u6216 IP</p></div>
  <div class="form-group"><label>\u4F18\u9009\u57DF\u540D / IP</label><input id="hostInput" placeholder="\u4F8B\u5982 youxuan.example.com \u6216 1.2.3.4"><p class="form-hint">\u7CFB\u7EDF\u4F1A\u81EA\u52A8\u8BC6\u522B\u57DF\u540D\u3001IPv4 \u6216 IPv6\uFF0C\u5E76\u5206\u522B\u521B\u5EFA CNAME\u3001A \u6216 AAAA \u8BB0\u5F55</p></div>
  <div class="form-group"><label>\u5907\u6CE8</label><input id="remarkInput" placeholder="\u53EF\u9009"></div>
  <div class="modal-actions"><button class="btn btn-outline" onclick="closeModal('modalDomain')">\u53D6\u6D88</button><button class="btn" onclick="saveDomain()">\u4FDD\u5B58</button></div>
</div></div>
<div id="modalUserRoute" class="modal"><div class="modal-inner">
  <div class="modal-header"><h2 class="modal-title" id="userRouteModalTitle">\u6DFB\u52A0\u8DEF\u7531</h2><p class="modal-desc">\u521B\u5EFA\u540E\u53EF\u901A\u8FC7\u4F60\u7684\u8BBF\u95EE\u57DF\u540D\u52A0\u8DEF\u5F84\u8BBF\u95EE\u76EE\u6807\u670D\u52A1</p></div>
  <input type="hidden" id="userOldPrefix">
  <div class="form-group"><label>\u5907\u6CE8\u540D</label><input id="userRouteRemark" placeholder="\u4F8B\u5982\uFF1A\u6211\u7684 Emby \u670D\u52A1\u5668"></div>
  <div class="form-group"><label>\u8DEF\u5F84 (prefix)</label><input id="userRoutePrefix" placeholder="myemby" oninput="updateUserPrefixPreview()"><p class="form-hint">\u8BBF\u95EE\u8DEF\u5F84: https://${u.username}.${baseDomain}/<span id="userPrefixPreview">myemby</span></p></div>
  <div class="form-group">
    <label>\u76EE\u6807\u7EBF\u8DEF (target)</label>
    <div id="userTargetInputs" class="target-inputs">
      <div class="target-input-row"><input type="url" class="user-target-url-input" placeholder="\u4E3B\u7EBF\u8DEF\u5730\u5740 (\u5982: https://emby.example.com:8096)"><button class="btn-remove" onclick="removeUserTargetInput(this)" title="\u79FB\u9664">\u2715</button></div>
    </div>
    <button class="btn btn-outline btn-sm" style="margin-top:8px" onclick="addUserTargetInput()">\u6DFB\u52A0\u5907\u7528\u7EBF\u8DEF</button>
    <p class="form-hint">\u591A\u4E2A\u7EBF\u8DEF\u6309\u987A\u5E8F failover\uFF0C\u6D4B\u901F\u540E\u6309\u5EF6\u8FDF\u6392\u5E8F\u4F18\u9009</p>
  </div>
  <div class="form-group">
    <label class="checkbox-label"><input type="checkbox" id="userRouteCache" checked> \u542F\u7528\u56FE\u7247/\u9759\u6001\u8D44\u6E90\u7F13\u5B58</label>
    <label class="checkbox-label" style="margin-top:12px"><input type="checkbox" id="userRouteCompat"> \u517C\u5BB9\u6A21\u5F0F</label>
    <p class="form-hint">\u517C\u5BB9\u6A21\u5F0F\u9002\u7528\u4E8E\u90E8\u5206\u65E0\u6CD5\u6B63\u5E38\u64AD\u653E\u7684 Emby \u670D\u52A1\u5668</p>
  </div>
  <div class="modal-actions"><button class="btn btn-outline" onclick="closeModal('modalUserRoute')">\u53D6\u6D88</button><button class="btn" onclick="saveUserRoute()">\u4FDD\u5B58</button></div>
</div></div>
<script>
let myRoutes=[];
function closeModal(id){document.getElementById(id).classList.remove('show');}
function openModal(id){document.getElementById(id).classList.add('show');}
function doLogout(){document.cookie='user_token=;path=/;max-age=0';location.reload();}
function showToast(msg){var t=document.getElementById('toast');if(!t){t=document.createElement('div');t.id='toast';document.body.appendChild(t);}t.textContent=msg;t.classList.add('show');setTimeout(function(){t.classList.remove('show');},2500);}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function enc(v){return encodeURIComponent(String(v==null?'':v));}
function getLatencyInfo(ms){if(ms<0)return {text:'\u8D85\u65F6',cls:'tag-timeout',color:'#ff5c7a'};if(ms<100)return {text:'\u6781\u5FEB',cls:'tag-fast',color:'#00ff9d'};if(ms<300)return {text:'\u826F\u597D',cls:'tag-good',color:'#00e5ff'};return {text:'\u8F83\u6162',cls:'tag-slow',color:'#ffb454'};}
function parseLatencies(latStr){if(!latStr)return {};try{return JSON.parse(latStr);}catch(e){return {};}}
async function loadDomains(){
  var r=await fetch('/api/user/domains');var d=await r.json();var box=document.getElementById('domainList');
  if(!d.domains||!d.domains.length){box.innerHTML='<div class="empty-state" style="grid-column:1/-1"><span class="empty-state-icon"></span><p class="empty-state-text">\u8FD8\u6CA1\u6709\u8BBF\u95EE\u57DF\u540D</p></div>';return;}
  box.innerHTML=d.domains.map(function(x){return '<div class="route-item"><div class="route-header"><div class="route-title"><h3 class="route-name">'+esc(x.subdomain)+'.${baseDomain}</h3><span class="route-path">'+esc(x.preferred_host)+'</span></div></div><div class="route-meta">'+(x.remark?'<span class="meta-tag">'+esc(x.remark)+'</span>':'')+'<span class="meta-tag '+(x.status==='active'?'meta-tag-on':'meta-tag-warn')+'">'+(x.status==='active'?'ACTIVE':'DISABLED')+'</span><button class="btn btn-sm btn-outline" onclick="editDomain(\\''+enc(x.subdomain)+'\\',\\''+enc(x.preferred_host)+'\\',\\''+enc(x.remark||'')+'\\')">\u4FEE\u6539\u76EE\u6807</button></div></div>';}).join('');
}
function editDomain(sub,host,remark){document.getElementById('hostInput').value=decodeURIComponent(host||'');document.getElementById('remarkInput').value=decodeURIComponent(remark||'');openModal('modalDomain');}
async function saveDomain(){
  var host=document.getElementById('hostInput').value.trim();
  var remark=document.getElementById('remarkInput').value.trim();
  if(!host){showToast('\u8BF7\u586B\u5199\u4F18\u9009\u57DF\u540D/IP');return;}
  var r=await fetch('/api/user/domains',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({preferred_host:host,remark:remark})});
  var d=await r.json();
  if(d.ok){closeModal('modalDomain');document.getElementById('hostInput').value='';document.getElementById('remarkInput').value='';loadDomains();showToast('DNS \u8BB0\u5F55\u5DF2\u66F4\u65B0');}else{showToast(d.error||'\u5931\u8D25');}
}
async function loadUserRoutes(){
  const r=await fetch('/api/user/routes');
  if(r.status===401){location.reload();return;}
  const d=await r.json();
  myRoutes=d.routes||[];
  renderUserRoutes(myRoutes);
}
function renderUserRoutes(list){
  const el=document.getElementById('userRouteList');
  if(!list.length){el.innerHTML='<div class="empty-state" style="grid-column:1/-1"><span class="empty-state-icon"></span><p class="empty-state-text">\u6682\u65E0\u8DEF\u7531\uFF0C\u70B9\u51FB\u4E0A\u65B9\u6309\u94AE\u6DFB\u52A0</p></div>';return;}
  el.innerHTML=list.map(function(r){
    const targets=String(r.target||'').split(',').map(function(s){return s.trim();}).filter(Boolean);
    const latencies=parseLatencies(r.target_latencies);
    const remarkName=r.remark||'\u672A\u547D\u540D';
    const cacheStatus=r.cache_img!=='off';
    const compatStatus=r.compat_mode==='on';
    let targetsHtml='';
    targets.forEach(function(t,idx){
      const lat=latencies[t];
      const latInfo=getLatencyInfo(lat);
      const tag=idx===0?'<span class="tag tag-fast">\u4E3B</span>':'<span class="tag tag-slow">\u5907'+idx+'</span>';
      const latDisplay=typeof lat==='number'&&lat>=0?'<span class="target-latency" style="color:'+latInfo.color+'">'+lat+'ms <span class="tag '+latInfo.cls+'">'+latInfo.text+'</span></span>':'<span class="target-latency" style="color:#5d7290">\u672A\u6D4B\u901F</span>';
      targetsHtml+='<div class="target-row">'+tag+' <span class="target-url"><code>'+esc(t)+'</code></span>'+latDisplay+'</div>';
    });
    return '<div class="route-item" data-search="'+esc((remarkName+' '+r.prefix).toLowerCase())+'">'+
      '<div class="route-header"><div class="route-title"><h3 class="route-name">'+esc(remarkName)+'</h3><span class="route-path">/'+esc(r.prefix)+'</span></div></div>'+
      '<div class="target-list">'+targetsHtml+'</div>'+
      '<div class="route-meta">'+
        (cacheStatus?'<span class="meta-tag meta-tag-on">\u7F13\u5B58 ON</span>':'<span class="meta-tag">\u7F13\u5B58 OFF</span>')+
        (compatStatus?'<span class="meta-tag meta-tag-warn">\u517C\u5BB9\u6A21\u5F0F</span>':'')+
        (r.last_play?'<span class="meta-tag">'+esc(r.last_play)+'</span>':'')+
      '</div>'+
      '<div class="route-actions">'+
        '<button class="btn btn-sm btn-outline" onclick="speedtestUserRoute(\\''+enc(r.prefix)+'\\')">\u6D4B\u901F</button>'+
        '<button class="btn btn-sm btn-outline" onclick="editUserRoute(\\''+enc(r.prefix)+'\\')">\u7F16\u8F91</button>'+
        '<button class="btn btn-sm btn-del" onclick="delUserRoute(\\''+enc(r.prefix)+'\\')">\u5220\u9664</button>'+
      '</div></div>';
  }).join('');
}
function filterUserRoutes(){
  const q=document.getElementById('userRouteSearch').value.toLowerCase();
  document.querySelectorAll('#userRouteList .route-item').forEach(function(c){c.style.display=(!q||c.dataset.search.includes(q))?'block':'none';});
}
function updateUserPrefixPreview(){document.getElementById('userPrefixPreview').textContent=document.getElementById('userRoutePrefix').value.trim().replace(/^\\/+|\\/+$/g,'')||'myemby';}
function addUserTargetInput(){
  var container=document.getElementById('userTargetInputs');
  var row=document.createElement('div');
  row.className='target-input-row';
  row.innerHTML='<input type="url" class="user-target-url-input" placeholder="\u5907\u7528\u7EBF\u8DEF\u5730\u5740"><button class="btn-remove" onclick="removeUserTargetInput(this)" title="\u79FB\u9664">\u2715</button>';
  container.appendChild(row);
}
function removeUserTargetInput(btn){
  var container=document.getElementById('userTargetInputs');
  if(container.querySelectorAll('.target-input-row').length>1)btn.parentElement.remove();
}
function openUserRouteModal(){
  document.getElementById('userOldPrefix').value='';
  document.getElementById('userRouteRemark').value='';
  document.getElementById('userRoutePrefix').value='';
  document.getElementById('userRouteCache').checked=true;
  document.getElementById('userRouteCompat').checked=false;
  document.getElementById('userPrefixPreview').textContent='myemby';
  document.getElementById('userRouteModalTitle').textContent='\u6DFB\u52A0\u8DEF\u7531';
  document.getElementById('userTargetInputs').innerHTML='<div class="target-input-row"><input type="url" class="user-target-url-input" placeholder="\u4E3B\u7EBF\u8DEF\u5730\u5740 (\u5982: https://emby.example.com:8096)"><button class="btn-remove" onclick="removeUserTargetInput(this)" title="\u79FB\u9664">\u2715</button></div>';
  openModal('modalUserRoute');
}
function editUserRoute(prefixValue){
  const prefix=decodeURIComponent(prefixValue||'');
  const r=myRoutes.find(function(x){return x.prefix===prefix;});
  if(!r)return;
  document.getElementById('userOldPrefix').value=r.prefix;
  document.getElementById('userRouteRemark').value=r.remark||'';
  document.getElementById('userRoutePrefix').value=r.prefix;
  document.getElementById('userRouteCache').checked=r.cache_img!=='off';
  document.getElementById('userRouteCompat').checked=r.compat_mode==='on';
  document.getElementById('userPrefixPreview').textContent=r.prefix;
  document.getElementById('userRouteModalTitle').textContent='\u7F16\u8F91\u8DEF\u7531';
  var container=document.getElementById('userTargetInputs');
  container.innerHTML='';
  var targets=String(r.target||'').split(',').map(function(s){return s.trim();}).filter(Boolean);
  targets.forEach(function(t){
    var row=document.createElement('div');
    row.className='target-input-row';
    row.innerHTML='<input type="url" class="user-target-url-input" value="'+esc(t)+'"><button class="btn-remove" onclick="removeUserTargetInput(this)" title="\u79FB\u9664">\u2715</button>';
    container.appendChild(row);
  });
  if(!targets.length){
    container.innerHTML='<div class="target-input-row"><input type="url" class="user-target-url-input" placeholder="\u4E3B\u7EBF\u8DEF\u5730\u5740"><button class="btn-remove" onclick="removeUserTargetInput(this)" title="\u79FB\u9664">\u2715</button></div>';
  }
  openModal('modalUserRoute');
}
async function saveUserRoute(){
  const oldPrefix=document.getElementById('userOldPrefix').value;
  const remark=document.getElementById('userRouteRemark').value.trim();
  const prefix=document.getElementById('userRoutePrefix').value.trim().replace(/^\\/+|\\/+$/g,'');
  const cache_img=document.getElementById('userRouteCache').checked?'on':'off';
  const compat_mode=document.getElementById('userRouteCompat').checked?'on':'off';
  var targets=[];
  document.querySelectorAll('.user-target-url-input').forEach(function(inp){
    var val=inp.value.trim().replace(/\\/$/g,'');
    if(val)targets.push(val);
  });
  if(!prefix){showToast('\u8BF7\u8F93\u5165\u8DEF\u5F84');return;}
  if(!targets.length){showToast('\u8BF7\u81F3\u5C11\u586B\u5199\u4E00\u4E2A\u4E3B\u7EBF\u8DEF\u5730\u5740');return;}
  const r=await fetch('/api/user/routes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({oldPrefix:oldPrefix,prefix:prefix,target:targets.join(','),remark:remark,cache_img:cache_img,compat_mode:compat_mode})});
  const d=await r.json();
  if(!r.ok||!d.ok){showToast(d.error||'\u4FDD\u5B58\u5931\u8D25');return;}
  closeModal('modalUserRoute');
  showToast('\u8DEF\u7531\u5DF2\u4FDD\u5B58');
  loadUserRoutes();
}
async function delUserRoute(prefixValue){
  const prefix=decodeURIComponent(prefixValue||'');
  if(!confirm('\u786E\u5B9A\u5220\u9664\u8DEF\u7531 /'+prefix+' \uFF1F'))return;
  const r=await fetch('/api/user/routes?prefix='+encodeURIComponent(prefix),{method:'DELETE'});
  const d=await r.json();
  if(!r.ok||!d.ok){showToast(d.error||'\u5220\u9664\u5931\u8D25');return;}
  showToast('\u5DF2\u5220\u9664');
  loadUserRoutes();
}
async function speedtestUserRoute(prefixValue){
  const prefix=decodeURIComponent(prefixValue||'');
  showToast('\u6D4B\u901F\u4E2D...');
  const r=await fetch('/api/user/speedtest/routes?prefix='+encodeURIComponent(prefix),{method:'POST'});
  const d=await r.json();
  if(!r.ok||!d.ok){showToast(d.error||'\u6D4B\u901F\u5931\u8D25');return;}
  const ok=(d.results||[]).filter(function(x){return x.latency>=0;}).length;
  showToast('\u6D4B\u901F\u5B8C\u6210\uFF0C'+ok+'\u6761\u7EBF\u8DEF\u53EF\u7528');
  loadUserRoutes();
}
loadDomains();
loadUserRoutes();
<\/script></div></body></html>`;
}
__name(buildUserHtml, "buildUserHtml");
function getClientCacheKey(request) {
  const ip = request.headers.get("cf-connecting-ip") || "0.0.0.0";
  const cf = request.cf || {};
  let ipKey = ip;
  if (ip.includes(".")) ipKey = ip.split(".").slice(0, 3).join(".");
  else if (ip.includes(":")) ipKey = ip.split(":").slice(0, 4).join(":");
  return `${cf.country || "XX"}|${cf.city || ""}|${cf.asn || ""}|${ipKey}`;
}
__name(getClientCacheKey, "getClientCacheKey");
function optimizedHost(item) {
  return item.subdomain ? `${item.subdomain}.${item.domain}` : item.domain;
}
__name(optimizedHost, "optimizedHost");
function latencyStatus(ms) {
  if (ms < 0) return "timeout";
  if (ms < 100) return "fast";
  if (ms < 300) return "good";
  return "slow";
}
__name(latencyStatus, "latencyStatus");
async function initDatabase(env2) {
  if (!env2.DB || dbReady) return;
  await createDatabaseTables(env2);
  dbReady = true;
}
__name(initDatabase, "initDatabase");
function databaseSchemaStatements(env2) {
  return [
    env2.DB.prepare(`CREATE TABLE IF NOT EXISTS routes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prefix TEXT NOT NULL, target TEXT NOT NULL,
      remark TEXT DEFAULT '', last_play TEXT DEFAULT '',
      cache_img TEXT DEFAULT 'on', compat_mode TEXT DEFAULT 'off',
      sort_order INTEGER DEFAULT 0, target_latencies TEXT DEFAULT '',
      user_id INTEGER DEFAULT NULL)`),
    env2.DB.prepare(`CREATE TABLE IF NOT EXISTS visitor_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, prefix TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, ip TEXT, country TEXT, ua TEXT)`),
    env2.DB.prepare(`CREATE TABLE IF NOT EXISTS request_stats (
      prefix TEXT, date TEXT, count INTEGER DEFAULT 0, PRIMARY KEY(prefix, date))`),
    env2.DB.prepare(`CREATE TABLE IF NOT EXISTS auto_emby_daily_stats (
      date TEXT PRIMARY KEY, playing_count INTEGER DEFAULT 0, playback_info_count INTEGER DEFAULT 0)`),
    env2.DB.prepare(`CREATE TABLE IF NOT EXISTS domain_speed_cache (
      cache_key TEXT NOT NULL, subdomain TEXT NOT NULL, domain TEXT NOT NULL,
      display_name TEXT, latency_ms INTEGER DEFAULT -1, status TEXT DEFAULT 'unknown',
      tested_at INTEGER NOT NULL, PRIMARY KEY (cache_key, subdomain, domain))`),
    env2.DB.prepare(`CREATE TABLE IF NOT EXISTS domain_best_cache (
      cache_key TEXT PRIMARY KEY, best_host TEXT, best_name TEXT, best_latency INTEGER,
      tested_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)`),
    env2.DB.prepare(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`),
    env2.DB.prepare(`CREATE TABLE IF NOT EXISTS user_domains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      subdomain TEXT UNIQUE NOT NULL,
      preferred_host TEXT NOT NULL,
      remark TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      dns_record_id TEXT DEFAULT '',
      dns_record_type TEXT DEFAULT '')`),
    env2.DB.prepare(`CREATE TABLE IF NOT EXISTS invite_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'unused',
      used_by INTEGER DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      used_at DATETIME DEFAULT NULL)`)
  ];
}
__name(databaseSchemaStatements, "databaseSchemaStatements");
async function createDatabaseTables(env2) {
  await env2.DB.batch([
    ...databaseSchemaStatements(env2)
  ]);
  try {
    await env2.DB.exec(`ALTER TABLE routes ADD COLUMN target_latencies TEXT DEFAULT ''`);
  } catch (e) {
  }
  try {
    await env2.DB.exec(`ALTER TABLE routes ADD COLUMN compat_mode TEXT DEFAULT 'off'`);
  } catch (e) {
  }
  try {
    await env2.DB.exec(`ALTER TABLE routes ADD COLUMN user_id INTEGER DEFAULT NULL`);
  } catch (e) {
  }
  await migrateRoutesTable(env2);
  await createRouteIndexes(env2);
  try {
    await env2.DB.exec(`ALTER TABLE invite_codes ADD COLUMN used_at DATETIME DEFAULT NULL`);
  } catch (e) {
  }
  try {
    await env2.DB.exec(`ALTER TABLE user_domains ADD COLUMN dns_record_id TEXT DEFAULT ''`);
  } catch (e) {
  }
  try {
    await env2.DB.exec(`ALTER TABLE user_domains ADD COLUMN dns_record_type TEXT DEFAULT ''`);
  } catch (e) {
  }
}
__name(createDatabaseTables, "createDatabaseTables");
async function createRouteIndexes(env2) {
  await env2.DB.batch([
    env2.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_routes_user_prefix
      ON routes(user_id, prefix) WHERE user_id IS NOT NULL`),
    env2.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_routes_global_prefix
      ON routes(prefix) WHERE user_id IS NULL`)
  ]);
}
__name(createRouteIndexes, "createRouteIndexes");
async function migrateRoutesTable(env2) {
  const info3 = await env2.DB.prepare("PRAGMA table_info(routes)").all();
  const cols = info3.results || [];
  const prefixCol = cols.find((c) => c.name === "prefix");
  const hasId = cols.some((c) => c.name === "id");
  const prefixIsPrimaryKey = Boolean(prefixCol?.pk);
  if (!cols.length || hasId && !prefixIsPrimaryKey) return;
  await env2.DB.prepare("DROP TABLE IF EXISTS routes_migration_new").run();
  await env2.DB.prepare(`CREATE TABLE routes_migration_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prefix TEXT NOT NULL, target TEXT NOT NULL,
    remark TEXT DEFAULT '', last_play TEXT DEFAULT '',
    cache_img TEXT DEFAULT 'on', compat_mode TEXT DEFAULT 'off',
    sort_order INTEGER DEFAULT 0, target_latencies TEXT DEFAULT '',
    user_id INTEGER DEFAULT NULL)`).run();
  await env2.DB.prepare(`INSERT INTO routes_migration_new
    (prefix, target, remark, last_play, cache_img, compat_mode, sort_order, target_latencies, user_id)
    SELECT prefix, target,
      COALESCE(remark, ''), COALESCE(last_play, ''),
      COALESCE(cache_img, 'on'), COALESCE(compat_mode, 'off'),
      COALESCE(sort_order, 0), COALESCE(target_latencies, ''),
      user_id
    FROM routes`).run();
  await env2.DB.prepare("DROP TABLE routes").run();
  await env2.DB.prepare("ALTER TABLE routes_migration_new RENAME TO routes").run();
}
__name(migrateRoutesTable, "migrateRoutesTable");
async function resetDatabaseTables(env2) {
  const dnsWarnings = [];
  let domainRows = [];
  try {
    const table3 = await env2.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'user_domains'"
    ).first();
    if (table3) {
      const result = await env2.DB.prepare("SELECT subdomain FROM user_domains").all();
      domainRows = result.results || [];
    }
  } catch (_) {
  }
  const dnsConfig = getDnsConfig(env2);
  if (dnsConfig.zoneId && dnsConfig.token) {
    for (const row of domainRows) {
      try {
        await deleteUserDnsRecords(env2, row.subdomain);
      } catch (e) {
        dnsWarnings.push(`${row.subdomain}: ${e.message}`);
      }
    }
  }
  await env2.DB.batch([...DATABASE_TABLES].reverse().map((table3) => env2.DB.prepare(`DROP TABLE IF EXISTS ${table3}`)));
  await createDatabaseTables(env2);
  dbReady = true;
  return dnsWarnings;
}
__name(resetDatabaseTables, "resetDatabaseTables");
async function getEdgeInfo(request) {
  const cf = request.cf || {};
  let traceIp = "";
  let traceColo = cf.colo || "\u672A\u77E5";
  try {
    const tr = await fetch("https://1.1.1.1/cdn-cgi/trace", { headers: { "User-Agent": "CF-Worker-Trace" } });
    const text = await tr.text();
    const coloM = text.match(/colo=([A-Z0-9]+)/);
    const ipM = text.match(/ip=([^\n]+)/);
    if (coloM) traceColo = coloM[1];
    if (ipM) traceIp = ipM[1].trim();
  } catch (_) {
  }
  return {
    clientIp: request.headers.get("cf-connecting-ip") || "\u672A\u77E5",
    entryColo: cf.colo || "\u672A\u77E5",
    entryCountry: cf.country || "\u672A\u77E5",
    entryCity: cf.city || "",
    edgeIp: traceIp || "\u2014",
    egressColo: traceColo,
    cacheKey: getClientCacheKey(request)
  };
}
__name(getEdgeInfo, "getEdgeInfo");
async function speedtestUrl(urlStr, timeoutMs = 5e3) {
  const start = Date.now();
  try {
    const u = new URL(urlStr.startsWith("http") ? urlStr : "https://" + urlStr);
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(u.origin + "/", { method: "HEAD", signal: ctrl.signal, redirect: "manual" });
    clearTimeout(tid);
    if (res.status === 502 || res.status === 503 || res.status === 504) return -1;
    return Date.now() - start;
  } catch {
    return -1;
  }
}
__name(speedtestUrl, "speedtestUrl");
async function speedtestOptimizedFromEdge() {
  const results = [];
  for (const item of OPTIMIZED_DOMAINS) {
    const host = optimizedHost(item);
    const ms = await speedtestUrl(`https://${host}/cdn-cgi/trace`, 4e3);
    results.push({
      subdomain: item.subdomain,
      domain: item.domain,
      name: item.name,
      host,
      latency: ms,
      status: latencyStatus(ms)
    });
  }
  results.sort((a, b) => {
    if (a.latency < 0 && b.latency < 0) return 0;
    if (a.latency < 0) return 1;
    if (b.latency < 0) return -1;
    return a.latency - b.latency;
  });
  const best = results.find((r) => r.latency >= 0);
  return { results, best: best ? best.host : null };
}
__name(speedtestOptimizedFromEdge, "speedtestOptimizedFromEdge");
async function speedtestRouteTargets(env2, prefix) {
  const route = await env2.DB.prepare("SELECT * FROM routes WHERE prefix = ? AND user_id IS NULL").bind(prefix).first();
  if (!route) return [];
  const targets = route.target.split(",").map((s) => s.trim()).filter(Boolean);
  const latencies = {};
  const out = [];
  for (const t of targets) {
    const ms = await speedtestUrl(t);
    latencies[t] = ms;
    out.push({ url: t, latency: ms, status: latencyStatus(ms) });
  }
  await env2.DB.prepare("UPDATE routes SET target_latencies = ? WHERE prefix = ? AND user_id IS NULL").bind(JSON.stringify(latencies), prefix).run();
  out.sort((a, b) => {
    if (a.latency < 0 && b.latency < 0) return 0;
    if (a.latency < 0) return 1;
    if (b.latency < 0) return -1;
    return a.latency - b.latency;
  });
  return out;
}
__name(speedtestRouteTargets, "speedtestRouteTargets");
async function speedtestUserRouteTargets(env2, prefix, userId) {
  const route = await env2.DB.prepare("SELECT * FROM routes WHERE prefix = ? AND user_id = ?").bind(prefix, userId).first();
  if (!route) return null;
  const targets = route.target.split(",").map((s) => s.trim()).filter(Boolean);
  const latencies = {};
  const out = [];
  for (const t of targets) {
    const ms = await speedtestUrl(t);
    latencies[t] = ms;
    out.push({ url: t, latency: ms, status: latencyStatus(ms) });
  }
  await env2.DB.prepare("UPDATE routes SET target_latencies = ? WHERE prefix = ? AND user_id = ?").bind(JSON.stringify(latencies), prefix, userId).run();
  out.sort((a, b) => {
    if (a.latency < 0 && b.latency < 0) return 0;
    if (a.latency < 0) return 1;
    if (b.latency < 0) return -1;
    return a.latency - b.latency;
  });
  return out;
}
__name(speedtestUserRouteTargets, "speedtestUserRouteTargets");
async function speedtestAllRoutes(env2) {
  const { results: routes } = await env2.DB.prepare("SELECT prefix, target FROM routes WHERE user_id IS NULL ORDER BY sort_order, prefix").all();
  const allResults = {};
  for (const route of routes || []) {
    const targets = route.target.split(",").map((s) => s.trim()).filter(Boolean);
    const latencies = {};
    for (const t of targets) {
      const ms = await speedtestUrl(t);
      latencies[t] = ms;
    }
    await env2.DB.prepare("UPDATE routes SET target_latencies = ? WHERE prefix = ? AND user_id IS NULL").bind(JSON.stringify(latencies), route.prefix).run();
    allResults[route.prefix] = Object.entries(latencies).map(([url, latency]) => ({
      url,
      latency,
      status: latencyStatus(latency)
    }));
  }
  return allResults;
}
__name(speedtestAllRoutes, "speedtestAllRoutes");
async function saveDomainSpeedCache(env2, cacheKey, rows) {
  const now = Date.now();
  const expires = now + CONFIG.domainCacheTtlMs;
  const unique = /* @__PURE__ */ new Map();
  for (const r of rows) {
    const host = optimizedHost(r);
    if (host) unique.set(host, { ...r, host });
  }
  const cleanRows = [...unique.values()];
  const stmts = [
    env2.DB.prepare("DELETE FROM domain_speed_cache WHERE cache_key = ?").bind(cacheKey),
    env2.DB.prepare("DELETE FROM domain_best_cache WHERE cache_key = ?").bind(cacheKey)
  ];
  for (const r of cleanRows) {
    stmts.push(env2.DB.prepare(
      `INSERT INTO domain_speed_cache (cache_key, subdomain, domain, display_name, latency_ms, status, tested_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(cache_key, subdomain, domain) DO UPDATE SET
       latency_ms=excluded.latency_ms, status=excluded.status, tested_at=excluded.tested_at`
    ).bind(cacheKey, r.subdomain, r.domain, r.name || r.display_name, r.latency, r.status, now));
  }
  const sorted = cleanRows.filter((r) => r.latency >= 0).sort((a, b) => a.latency - b.latency);
  const best = sorted[0];
  if (best) {
    const host = optimizedHost(best);
    stmts.push(env2.DB.prepare(
      `INSERT INTO domain_best_cache (cache_key, best_host, best_name, best_latency, tested_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(cache_key) DO UPDATE SET
       best_host=excluded.best_host, best_name=excluded.best_name, best_latency=excluded.best_latency,
       tested_at=excluded.tested_at, expires_at=excluded.expires_at`
    ).bind(cacheKey, host, best.name || best.display_name, best.latency, now, expires));
  }
  await env2.DB.batch(stmts);
}
__name(saveDomainSpeedCache, "saveDomainSpeedCache");
async function loadDomainSpeedCache(env2, cacheKey) {
  const now = Date.now();
  const best = await env2.DB.prepare(
    "SELECT * FROM domain_best_cache WHERE cache_key = ? AND expires_at > ?"
  ).bind(cacheKey, now).first();
  if (!best) return null;
  const { results } = await env2.DB.prepare(
    "SELECT subdomain, domain, display_name, latency_ms, status, tested_at FROM domain_speed_cache WHERE cache_key = ? ORDER BY latency_ms ASC"
  ).bind(cacheKey).all();
  if (!results?.length) return null;
  const validHosts = new Set(OPTIMIZED_DOMAINS.map(optimizedHost));
  const currentResults = results.filter((r) => validHosts.has(optimizedHost(r)));
  if (!currentResults.length) return null;
  const bestRow = currentResults.find((r) => optimizedHost(r) === best.best_host) || currentResults.find((r) => r.latency_ms >= 0);
  return {
    cached: true,
    cacheKey,
    best: bestRow ? optimizedHost(bestRow) : null,
    bestName: bestRow ? bestRow.display_name : best.best_name,
    results: currentResults.map((r) => ({
      subdomain: r.subdomain,
      domain: r.domain,
      name: r.display_name,
      host: optimizedHost(r),
      latency: r.latency_ms,
      status: r.status
    })),
    expiresAt: best.expires_at
  };
}
__name(loadDomainSpeedCache, "loadDomainSpeedCache");
async function recordStats(env2, type) {
  if (!env2.DB || !CONFIG.enableStats) return;
  const today = (/* @__PURE__ */ new Date()).toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
  const q = type === "playing" ? `INSERT INTO auto_emby_daily_stats (date, playing_count, playback_info_count) VALUES (?, 1, 0)
       ON CONFLICT(date) DO UPDATE SET playing_count = playing_count + 1` : `INSERT INTO auto_emby_daily_stats (date, playing_count, playback_info_count) VALUES (?, 0, 1)
       ON CONFLICT(date) DO UPDATE SET playback_info_count = playback_info_count + 1`;
  await env2.DB.prepare(q).bind(today).run();
}
__name(recordStats, "recordStats");
async function handleStatsRequest(env2) {
  if (!env2.DB) return json({ error: "D1 \u6570\u636E\u5E93\u672A\u7ED1\u5B9A", data: null });
  const statsResult = await env2.DB.prepare(
    `SELECT date, playing_count, playback_info_count FROM auto_emby_daily_stats
     WHERE date >= date('now', '-30 days') ORDER BY date DESC`
  ).all();
  const totalResult = await env2.DB.prepare(
    `SELECT SUM(playing_count) as total_playing, SUM(playback_info_count) as total_playback_info
     FROM auto_emby_daily_stats WHERE date >= date('now', '-30 days')`
  ).first();
  return json({
    error: null,
    data: {
      total: { playing: totalResult?.total_playing || 0, playbackInfo: totalResult?.total_playback_info || 0 },
      dailyStats: statsResult?.results || [],
      lastUpdated: (/* @__PURE__ */ new Date()).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })
    }
  });
}
__name(handleStatsRequest, "handleStatsRequest");
function normalizePrefix(p) {
  return String(p || "").trim().toLowerCase().replace(/^\/+|\/+$/g, "");
}
__name(normalizePrefix, "normalizePrefix");
function validatePrefix(prefix) {
  const a = normalizePrefix(prefix);
  if (!a || !/^[a-z0-9][a-z0-9_-]{0,62}$/i.test(a)) return "\u8DEF\u5F84\u4EC5\u5141\u8BB8\u5B57\u6BCD\u6570\u5B57\u3001\u4E0B\u5212\u7EBF\u548C\u8FDE\u5B57\u7B26";
  if (RESERVED_ALIASES.has(a.toLowerCase())) return "\u8BE5\u8DEF\u5F84\u4E3A\u7CFB\u7EDF\u4FDD\u7559\uFF0C\u4E0D\u53EF\u4F7F\u7528";
  return null;
}
__name(validatePrefix, "validatePrefix");
function normalizeRouteTarget(value) {
  const targets = String(value || "").split(",").map((s) => s.trim().replace(/\/+$/, "")).filter(Boolean);
  if (!targets.length) return { error: "\u8BF7\u81F3\u5C11\u586B\u5199\u4E00\u4E2A\u4E3B\u7EBF\u8DEF\u5730\u5740" };
  for (const target of targets) {
    try {
      const parsed = new URL(target);
      if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) {
        return { error: `\u76EE\u6807\u7EBF\u8DEF\u683C\u5F0F\u65E0\u6548\uFF1A${target}` };
      }
    } catch (_) {
      return { error: `\u76EE\u6807\u7EBF\u8DEF\u683C\u5F0F\u65E0\u6548\uFF1A${target}` };
    }
  }
  return { value: targets.join(",") };
}
__name(normalizeRouteTarget, "normalizeRouteTarget");
async function handleUserRouteApi(request, env2, url, user) {
  if (url.pathname === "/api/user/routes") {
    if (request.method === "GET") {
      const { results } = await env2.DB.prepare(
        "SELECT * FROM routes WHERE user_id = ? ORDER BY sort_order, prefix"
      ).bind(user.id).all();
      return json({ ok: true, routes: results || [] });
    }
    if (request.method === "POST") {
      const data = await request.json().catch(() => ({}));
      const err = validatePrefix(data.prefix);
      if (err) return json({ error: err }, 400);
      const prefix = normalizePrefix(data.prefix);
      const targetResult = normalizeRouteTarget(data.target);
      if (targetResult.error) return json({ error: targetResult.error }, 400);
      const remark = String(data.remark || "").trim().slice(0, 200);
      const cacheImg = data.cache_img === "off" ? "off" : "on";
      const compatMode = data.compat_mode === "on" ? "on" : "off";
      const oldPrefix = normalizePrefix(data.oldPrefix);
      try {
        if (oldPrefix && oldPrefix !== prefix) {
          const current = await env2.DB.prepare(
            "SELECT sort_order FROM routes WHERE prefix = ? AND user_id = ?"
          ).bind(oldPrefix, user.id).first();
          if (!current) return json({ error: "\u539F\u8DEF\u7531\u4E0D\u5B58\u5728\u6216\u4E0D\u5C5E\u4E8E\u5F53\u524D\u7528\u6237" }, 404);
          const conflict = await env2.DB.prepare(
            "SELECT prefix FROM routes WHERE prefix = ? AND user_id = ?"
          ).bind(prefix, user.id).first();
          if (conflict) return json({ error: "\u4F60\u7684\u8D26\u53F7\u91CC\u5DF2\u5B58\u5728\u8BE5\u8DEF\u5F84\uFF0C\u8BF7\u6362\u4E00\u4E2A\u8DEF\u5F84" }, 409);
          await env2.DB.batch([
            env2.DB.prepare("DELETE FROM routes WHERE prefix = ? AND user_id = ?").bind(oldPrefix, user.id),
            env2.DB.prepare(
              `INSERT INTO routes
               (prefix, target, remark, cache_img, compat_mode, sort_order, target_latencies, user_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(prefix, targetResult.value, remark, cacheImg, compatMode, current.sort_order || 0, "", user.id)
          ]);
        } else {
          const current = await env2.DB.prepare(
            "SELECT sort_order FROM routes WHERE prefix = ? AND user_id = ?"
          ).bind(prefix, user.id).first();
          if (current) {
            await env2.DB.prepare(
              `UPDATE routes SET target = ?, remark = ?, cache_img = ?, compat_mode = ?,
               target_latencies = '' WHERE prefix = ? AND user_id = ?`
            ).bind(targetResult.value, remark, cacheImg, compatMode, prefix, user.id).run();
          } else {
            await env2.DB.prepare(
              `INSERT INTO routes
               (prefix, target, remark, cache_img, compat_mode, sort_order, target_latencies, user_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(prefix, targetResult.value, remark, cacheImg, compatMode, 0, "", user.id).run();
          }
        }
        return json({ ok: true });
      } catch (e) {
        if (String(e?.message || "").toLowerCase().includes("unique")) {
          return json({ error: "\u4F60\u7684\u8D26\u53F7\u91CC\u5DF2\u5B58\u5728\u8BE5\u8DEF\u5F84\uFF0C\u8BF7\u6362\u4E00\u4E2A\u8DEF\u5F84" }, 409);
        }
        console.error("User route save failed:", e);
        return json({ error: "\u8DEF\u7531\u4FDD\u5B58\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5" }, 500);
      }
    }
    if (request.method === "DELETE") {
      const prefix = normalizePrefix(url.searchParams.get("prefix"));
      if (!prefix) return json({ error: "\u7F3A\u5C11 prefix \u53C2\u6570" }, 400);
      const result = await env2.DB.prepare(
        "DELETE FROM routes WHERE prefix = ? AND user_id = ?"
      ).bind(prefix, user.id).run();
      if (!result.meta?.changes) return json({ error: "\u8DEF\u7531\u4E0D\u5B58\u5728\u6216\u4E0D\u5C5E\u4E8E\u5F53\u524D\u7528\u6237" }, 404);
      return json({ ok: true });
    }
  }
  if (url.pathname === "/api/user/speedtest/routes" && request.method === "POST") {
    const prefix = normalizePrefix(url.searchParams.get("prefix"));
    if (!prefix) return json({ error: "\u7F3A\u5C11 prefix \u53C2\u6570" }, 400);
    const results = await speedtestUserRouteTargets(env2, prefix, user.id);
    if (!results) return json({ error: "\u8DEF\u7531\u4E0D\u5B58\u5728\u6216\u4E0D\u5C5E\u4E8E\u5F53\u524D\u7528\u6237" }, 404);
    return json({ ok: true, results });
  }
  return json({ error: "Not found" }, 404);
}
__name(handleUserRouteApi, "handleUserRouteApi");
async function handleAdminApi(request, env2, url) {
  if (!await hasAdminAccess(request, env2)) return new Response("Unauthorized", { status: 401 });
  if (url.pathname === "/admin/api/routes") {
    if (request.method === "GET") {
      const { results } = await env2.DB.prepare("SELECT * FROM routes WHERE user_id IS NULL ORDER BY sort_order, prefix").all();
      return json(results || []);
    }
    if (request.method === "POST") {
      const data = await request.json();
      const err = validatePrefix(data.prefix);
      if (err) return json({ error: err }, 400);
      const prefix = normalizePrefix(data.prefix);
      const oldPrefix = normalizePrefix(data.oldPrefix);
      let currentSortOrder = 0;
      if (oldPrefix && oldPrefix !== prefix) {
        const oldRow = await env2.DB.prepare("SELECT sort_order FROM routes WHERE prefix = ? AND user_id IS NULL").bind(oldPrefix).first();
        if (oldRow) {
          currentSortOrder = oldRow.sort_order;
        }
        await env2.DB.prepare("DELETE FROM routes WHERE prefix = ? AND user_id IS NULL").bind(oldPrefix).run();
      } else {
        const oldRow = await env2.DB.prepare("SELECT sort_order FROM routes WHERE prefix = ? AND user_id IS NULL").bind(prefix).first();
        if (oldRow) {
          currentSortOrder = oldRow.sort_order;
        }
      }
      await env2.DB.prepare(
        "INSERT OR REPLACE INTO routes (prefix, target, remark, cache_img, compat_mode, sort_order, target_latencies, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(
        prefix,
        data.target,
        data.remark || "",
        data.cache_img || "on",
        data.compat_mode || "off",
        currentSortOrder,
        "",
        null
      ).run();
      return json({ success: true });
    }
    if (request.method === "DELETE") {
      const prefix = url.searchParams.get("prefix");
      if (!prefix) return json({ error: "\u7F3A\u5C11 prefix \u53C2\u6570" }, 400);
      await env2.DB.prepare("DELETE FROM routes WHERE prefix = ? AND user_id IS NULL").bind(normalizePrefix(prefix)).run();
      return json({ success: true });
    }
  }
  if (url.pathname === "/admin/api/speedtest/routes" && request.method === "POST") {
    const prefix = url.searchParams.get("prefix");
    if (prefix) {
      const results = await speedtestRouteTargets(env2, normalizePrefix(prefix));
      return json({ results });
    }
    const allResults = await speedtestAllRoutes(env2);
    return json({ results: allResults });
  }
  if (url.pathname === "/admin/api/speedtest/domains" && request.method === "POST") {
    const data = await speedtestOptimizedFromEdge();
    return json(data);
  }
  if (url.pathname === "/admin/api/invites" && request.method === "GET") {
    const codes = await env2.DB.prepare(
      `SELECT i.code, i.status, i.used_by, i.created_at, i.used_at,
              u.username AS used_by_username
       FROM invite_codes i
       LEFT JOIN users u ON u.id = i.used_by
       ORDER BY i.id`
    ).all();
    const total = codes.results ? codes.results.length : 0;
    const used = codes.results ? codes.results.filter((c) => c.status === "used").length : 0;
    return json({ ok: true, total, used, remaining: total - used, codes: codes.results || [] });
  }
  if (url.pathname === "/admin/api/invites/release" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const code = String(body.code || "").trim();
    if (!code) return json({ error: "\u7F3A\u5C11\u9080\u8BF7\u7801" }, 400);
    const invite = await env2.DB.prepare(
      "SELECT id, used_by FROM invite_codes WHERE code = ? AND status = 'used'"
    ).bind(code).first();
    if (!invite) return json({ error: "\u9080\u8BF7\u7801\u4E0D\u5B58\u5728\u6216\u5F53\u524D\u672A\u4F7F\u7528" }, 404);
    let user = null;
    if (invite.used_by !== null && invite.used_by !== void 0) {
      user = await env2.DB.prepare(
        "SELECT id, username, role FROM users WHERE id = ?"
      ).bind(invite.used_by).first();
      if (user?.role === "admin") {
        return json({ error: "\u4E0D\u80FD\u901A\u8FC7\u91CA\u653E\u9080\u8BF7\u7801\u5220\u9664\u7BA1\u7406\u5458\u8D26\u53F7" }, 409);
      }
    }
    const dnsWarnings = [];
    if (user?.username && getDnsConfig(env2).zoneId && getDnsConfig(env2).token) {
      try {
        await deleteUserDnsRecords(env2, user.username);
      } catch (e) {
        dnsWarnings.push(`${user.username}: ${e.message}`);
      }
    }
    const statements = [];
    if (user) {
      statements.push(env2.DB.prepare("DELETE FROM routes WHERE user_id = ?").bind(user.id));
      statements.push(env2.DB.prepare("DELETE FROM user_domains WHERE user_id = ?").bind(user.id));
      statements.push(env2.DB.prepare("DELETE FROM users WHERE id = ?").bind(user.id));
    }
    statements.push(env2.DB.prepare(
      "UPDATE invite_codes SET status = 'unused', used_by = NULL, used_at = NULL WHERE id = ? AND status = 'used'"
    ).bind(invite.id));
    const results = await env2.DB.batch(statements);
    const releaseResult = results[results.length - 1];
    if (!releaseResult?.meta?.changes) return json({ error: "\u9080\u8BF7\u7801\u91CA\u653E\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5" }, 500);
    return json({ ok: true, releasedUsername: user?.username || null, dnsWarnings });
  }
  if (url.pathname === "/admin/api/invites/generate" && request.method === "POST") {
    const total = await env2.DB.prepare("SELECT COUNT(*) as c FROM invite_codes").first();
    if (total && total.c >= 50) return json({ error: "\u5DF2\u8FBE\u6700\u5927\u9080\u8BF7\u7801\u6570\u91CF(50)" }, 409);
    const body = await request.json().catch(() => ({}));
    const count3 = Math.min(Math.max(parseInt(body.count) || 10, 1), 50 - (total ? total.c : 0));
    const codes = [];
    for (let i = 0; i < count3; i++) {
      codes.push(genInviteCode());
    }
    const stmt = env2.DB.prepare("INSERT INTO invite_codes (code) VALUES (?)");
    await env2.DB.batch([...codes.map((c) => stmt.bind(c))]);
    return json({ ok: true, generated: count3, codes });
  }
  if (url.pathname === "/admin/api/database/reset" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    if (body.confirmation !== "RESET DATABASE") {
      return json({ error: "\u8BF7\u8F93\u5165 RESET DATABASE \u786E\u8BA4\u91CD\u7F6E" }, 400);
    }
    try {
      const dnsWarnings = await resetDatabaseTables(env2);
      return json({ ok: true, recreated: true, dnsWarnings });
    } catch (e) {
      console.error("Database reset failed:", e);
      return json({
        ok: false,
        error: `\u6570\u636E\u5E93\u91CD\u5EFA\u5931\u8D25\uFF1A${String(e?.message || "\u672A\u77E5\u9519\u8BEF").slice(0, 180)}`
      }, 500);
    }
  }
  return json({ error: "Not found" }, 404);
}
__name(handleAdminApi, "handleAdminApi");
async function resolveProxyTarget(request, env2, url, userId = null) {
  const decodedPath = decodeURIComponent(url.pathname);
  let upstreamUrls = [];
  let enableCache = true;
  let compatMode = false;
  let matchedPrefix = null;
  let matchedRouteId = null;
  let matchedUserId = null;
  let needsSpeedTest = false;
  const pathParts = decodedPath.split("/").filter(Boolean);
  const prefix = normalizeAlias(pathParts[0]);
  if (!prefix) return { error: new Response("Not Found", { status: 404 }) };
  let route = null;
  if (userId !== null && userId !== void 0) {
    route = await env2.DB.prepare("SELECT * FROM routes WHERE prefix = ? AND user_id = ?").bind(prefix, userId).first();
  }
  if (!route) {
    route = await env2.DB.prepare("SELECT * FROM routes WHERE prefix = ? AND user_id IS NULL").bind(prefix).first();
  }
  if (!route) return { error: new Response("404: \u8282\u70B9\u4E0D\u5B58\u5728", { status: 404 }) };
  matchedPrefix = route.prefix;
  matchedRouteId = route.id || null;
  matchedUserId = route.user_id ?? null;
  enableCache = route.cache_img !== "off";
  compatMode = route.compat_mode === "on";
  const remainingPath = "/" + pathParts.slice(1).join("/");
  let targetUrls = route.target.split(",").map((s) => s.trim()).filter(Boolean);
  if (remainingPath.startsWith("/http://") || remainingPath.startsWith("/https://")) {
    upstreamUrls = [remainingPath.substring(1) + url.search];
    enableCache = true;
  } else {
    if (targetUrls.length > 1 && route.target_latencies) {
      try {
        const latencies = JSON.parse(route.target_latencies);
        const hasAnyLatency = Object.values(latencies).some((v) => typeof v === "number" && v >= 0);
        if (hasAnyLatency) {
          targetUrls.sort((a, b) => {
            const la = latencies[a];
            const lb = latencies[b];
            if (typeof la !== "number" || la < 0) return 1;
            if (typeof lb !== "number" || lb < 0) return -1;
            return la - lb;
          });
        }
      } catch (_) {
      }
    }
    if (targetUrls.length > 1 && !route.target_latencies) {
      needsSpeedTest = true;
    }
    upstreamUrls = targetUrls.map((t) => t.replace(/\/+$/, "") + remainingPath + url.search);
  }
  return { upstreamUrls, enableCache, compatMode, matchedPrefix, matchedRouteId, matchedUserId, needsSpeedTest };
}
__name(resolveProxyTarget, "resolveProxyTarget");
function normalizeAlias(a) {
  return String(a || "").trim().toLowerCase().replace(/^\/+|\/+$/g, "");
}
__name(normalizeAlias, "normalizeAlias");
function parseDirectProxyTarget(pathname, search = "") {
  let target = String(pathname || "").replace(/^\/+/, "");
  if (!target) return { matched: false };
  try {
    target = decodeURIComponent(target);
  } catch (_) {
  }
  const explicitProtocol = /^https?:\/\//i.test(target) || /^https?:\/(?!\/)/i.test(target);
  const firstSegment = target.split("/")[0].toLowerCase();
  const shorthandTarget = firstSegment.includes(".") || firstSegment.includes(":");
  if (!explicitProtocol && !shorthandTarget) return { matched: false };
  target = target.replace(/^(https?):\/(?!\/)/i, "$1://");
  if (!/^https?:\/\//i.test(target)) target = `https://${target}`;
  try {
    const parsed = new URL(target);
    if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) {
      return { matched: true, error: "Invalid URL protocol" };
    }
    parsed.search = search;
    return { matched: true, url: parsed.toString() };
  } catch (_) {
    return { matched: true, error: "Invalid URL format" };
  }
}
__name(parseDirectProxyTarget, "parseDirectProxyTarget");
async function proxyDirectUrl(request, env2, ctx, upstreamUrls, opts = {}) {
  const {
    enableCache = true,
    compatMode = false,
    matchedPrefix = null,
    matchedRouteId = null,
    matchedUserId = null,
    needsSpeedTest = false,
    preferredHost = null,
    proxyPathPrefix = null
  } = opts;
  const proxyOrigin = new URL(request.url).origin;
  const proxyPrefix = proxyPathPrefix === null ? matchedPrefix ? `/${matchedPrefix}` : null : proxyPathPrefix;
  if (!upstreamUrls.length) return new Response("404: Target empty", { status: 404 });
  if (needsSpeedTest && matchedPrefix && env2.DB && ctx?.waitUntil) {
    if (matchedUserId !== null && matchedUserId !== void 0) {
      ctx.waitUntil(speedtestUserRouteTargets(env2, matchedPrefix, matchedUserId));
    } else {
      ctx.waitUntil(speedtestRouteTargets(env2, matchedPrefix));
    }
  }
  let firstUpstreamUrl;
  try {
    firstUpstreamUrl = new URL(upstreamUrls[0]);
  } catch {
    return new Response("Invalid upstream URL", { status: 500 });
  }
  const isPlaybackInfo = /\/PlaybackInfo/i.test(firstUpstreamUrl.pathname);
  const isPlaying = firstUpstreamUrl.pathname.endsWith("/Sessions/Playing");
  if (isPlaying && CONFIG.enableStats) {
    ctx.waitUntil(recordStats(env2, "playing"));
  }
  if (isPlaybackInfo) {
    ctx.waitUntil(recordStats(env2, "playback_info"));
  }
  if (matchedPrefix && env2.DB && ctx?.waitUntil && isPlaybackInfo) {
    const todayStr = new Date(Date.now() + 8 * 36e5).toISOString().split("T")[0];
    const nowTime = new Date(Date.now() + 8 * 36e5).toISOString().replace("T", " ").split(".")[0];
    const clientIp = request.headers.get("cf-connecting-ip") || "Unknown";
    const clientCountry = request.headers.get("cf-ipcountry") || "Unknown";
    const clientUa = request.headers.get("User-Agent") || "Unknown";
    try {
      let updateRouteStmt;
      if (matchedRouteId) {
        updateRouteStmt = env2.DB.prepare(`UPDATE routes SET last_play = ? WHERE id = ?`).bind(nowTime, matchedRouteId);
      } else if (matchedUserId !== null && matchedUserId !== void 0) {
        updateRouteStmt = env2.DB.prepare(`UPDATE routes SET last_play = ? WHERE prefix = ? AND user_id = ?`).bind(nowTime, matchedPrefix, matchedUserId);
      } else {
        updateRouteStmt = env2.DB.prepare(`UPDATE routes SET last_play = ? WHERE prefix = ? AND user_id IS NULL`).bind(nowTime, matchedPrefix);
      }
      ctx.waitUntil(env2.DB.batch([
        env2.DB.prepare(`INSERT INTO request_stats (prefix, date, count) VALUES (?, ?, 1) ON CONFLICT(prefix, date) DO UPDATE SET count = count + 1`).bind(matchedPrefix, todayStr),
        updateRouteStmt,
        env2.DB.prepare(`INSERT INTO visitor_logs (prefix, ip, country, ua) VALUES (?, ?, ?, ?)`).bind(matchedPrefix, clientIp, clientCountry, clientUa)
      ]));
    } catch (_) {
    }
  }
  const upgradeHeader = request.headers.get("Upgrade");
  if (upgradeHeader?.toLowerCase() === "websocket") {
    const wsHeaders = new Headers(request.headers);
    try {
      wsHeaders.set("Host", new URL(upstreamUrls[0]).host);
    } catch (_) {
    }
    wsHeaders.delete("Referer");
    const wsInit = { method: request.method, headers: wsHeaders, redirect: "follow" };
    if (preferredHost) wsInit.cf = { resolveOverride: preferredHost };
    return fetch(new Request(upstreamUrls[0], wsInit));
  }
  let requestBody = null;
  if (request.method !== "GET" && request.method !== "HEAD") {
    requestBody = await request.arrayBuffer();
  }
  let finalResponse = null;
  let lastError = null;
  let lastUpstreamUrl = null;
  for (let i = 0; i < upstreamUrls.length; i++) {
    let upstreamUrl;
    try {
      upstreamUrl = new URL(upstreamUrls[i]);
    } catch {
      lastError = new Error("Invalid target URL");
      continue;
    }
    if (PIKPAK_DOMAINS.some((d) => upstreamUrl.hostname.endsWith(d))) {
      return Response.redirect(new URL(upstreamUrl.pathname + upstreamUrl.search, CONFIG.pikpakProxyUrl).toString(), 301);
    }
    if (blocker.check(upstreamUrl.toString())) return Response.redirect("https://baidu.com", 301);
    const colo = request.cf?.colo;
    if (colo && JP_COLOS.includes(colo)) {
      for (const suffix in DOMAIN_PROXY_RULES) {
        if (upstreamUrl.host.endsWith(suffix)) {
          upstreamUrl.hostname = DOMAIN_PROXY_RULES[suffix];
          break;
        }
      }
    }
    const headers = new Headers(request.headers);
    headers.set("Host", upstreamUrl.host);
    headers.delete("Referer");
    const clientIp = request.headers.get("cf-connecting-ip");
    if (clientIp) {
      headers.set("x-forwarded-for", clientIp);
      headers.set("x-real-ip", clientIp);
    }
    if (compatMode) {
      headers.set("Origin", upstreamUrl.origin);
      headers.set("X-Forwarded-Proto", upstreamUrl.protocol.replace(":", ""));
      headers.set("X-Forwarded-Host", upstreamUrl.host);
    }
    const isStaticOrImage = /\.(jpg|jpeg|gif|png|svg|ico|webp|js|css|woff2?|ttf|otf|map|webmanifest|srt|ass|vtt|sub)$/i.test(upstreamUrl.pathname) || /(\/Images\/|\/Icons\/|\/Branding\/|\/emby\/covers\/)/i.test(upstreamUrl.pathname);
    const fetchInit = { method: request.method, headers, redirect: compatMode ? "follow" : "manual" };
    const cfOpts = {};
    if (isStaticOrImage && enableCache) {
      cfOpts.cacheEverything = true;
      cfOpts.cacheTtl = 86400;
    }
    if (preferredHost) cfOpts.resolveOverride = preferredHost;
    if (Object.keys(cfOpts).length) fetchInit.cf = cfOpts;
    if (requestBody) fetchInit.body = requestBody;
    try {
      const response = await fetch(new Request(upstreamUrl.toString(), fetchInit));
      if (!compatMode && [502, 503, 504].includes(response.status)) {
        lastError = new Error(`HTTP ${response.status}`);
        continue;
      }
      finalResponse = response;
      lastUpstreamUrl = upstreamUrl;
      break;
    } catch (err) {
      lastError = err;
      continue;
    }
  }
  if (!finalResponse) {
    return new Response("\u6240\u6709\u7EBF\u8DEF\u4E0D\u53EF\u7528: " + (lastError?.message || "Unknown"), { status: 502 });
  }
  if (!compatMode) {
    const location = finalResponse.headers.get("Location");
    if (location && finalResponse.status >= 300 && finalResponse.status < 400) {
      try {
        const redirectUrl = new URL(location, lastUpstreamUrl);
        if (redirectUrl.hostname === lastUpstreamUrl.hostname) {
          return fetch(redirectUrl.toString(), new Request(redirectUrl, { method: request.method, headers: finalResponse.headers, redirect: "follow" }));
        }
        if (MANUAL_REDIRECT_DOMAINS.some((d) => redirectUrl.hostname.endsWith(d))) {
          const rh = new Headers(finalResponse.headers);
          rh.set("Location", redirectUrl.toString());
          return new Response(finalResponse.body, { status: finalResponse.status, headers: rh });
        }
        if (proxyPrefix !== null) {
          const rh = new Headers(finalResponse.headers);
          rh.set("Location", `${proxyPrefix}/${encodeURIComponent(redirectUrl.toString())}`);
          return new Response(finalResponse.body, { status: finalResponse.status, headers: rh });
        }
        const fh = new Headers(request.headers);
        fh.set("Host", redirectUrl.host);
        fh.delete("Referer");
        const cIp = request.headers.get("cf-connecting-ip");
        if (cIp) {
          fh.set("x-forwarded-for", cIp);
          fh.set("x-real-ip", cIp);
        }
        return fetch(redirectUrl.toString(), { method: request.method, headers: fh, body: requestBody || void 0, redirect: "follow" });
      } catch (_) {
      }
    }
  }
  const responseHeaders = new Headers(finalResponse.headers);
  const contentType = finalResponse.headers.get("content-type") || "";
  if (!compatMode && finalResponse.status === 200 && contentType.includes("json") && proxyPrefix !== null) {
    const urlPath = lastUpstreamUrl.pathname.toLowerCase();
    if (urlPath.includes("playbackinfo")) {
      try {
        const data = await finalResponse.clone().json();
        let modified = false;
        if (data?.MediaSources) {
          data.MediaSources.forEach((source) => {
            ["DirectStreamUrl", "TranscodingUrl"].forEach((key) => {
              if (source[key]?.startsWith("http")) {
                try {
                  const mediaUrl = new URL(source[key]);
                  const isDirectDomain = MANUAL_REDIRECT_DOMAINS.some((d) => mediaUrl.hostname.endsWith(d));
                  if (!isDirectDomain) {
                    source[key] = proxyOrigin + proxyPrefix + "/" + source[key];
                    modified = true;
                  }
                } catch (_) {
                  source[key] = proxyOrigin + proxyPrefix + "/" + source[key];
                  modified = true;
                }
              }
            });
          });
        }
        if (modified) {
          responseHeaders.delete("Content-Length");
          return new Response(JSON.stringify(data), { status: finalResponse.status, headers: responseHeaders });
        }
      } catch (_) {
      }
    }
  }
  if (!compatMode && finalResponse.status === 200 && proxyPrefix !== null) {
    const urlPath = lastUpstreamUrl.pathname.toLowerCase();
    if (urlPath.endsWith(".m3u8")) {
      try {
        const text = await finalResponse.clone().text();
        if (text.includes("http://") || text.includes("https://")) {
          const modifiedText = text.replace(/(https?:\/\/[^\s]+)/g, (match) => {
            try {
              const mUrl = new URL(match);
              const isDirectDomain = MANUAL_REDIRECT_DOMAINS.some((d) => mUrl.hostname.endsWith(d));
              return isDirectDomain ? match : proxyOrigin + proxyPrefix + "/" + match;
            } catch (_) {
              return proxyOrigin + proxyPrefix + "/" + match;
            }
          });
          responseHeaders.delete("Content-Length");
          return new Response(modifiedText, { status: finalResponse.status, headers: responseHeaders });
        }
      } catch (_) {
      }
    }
  }
  if (CONFIG.cacheEnabled) {
    if (contentType.includes("image/") || contentType.includes("text/css") || contentType.includes("application/javascript")) {
      responseHeaders.set("Cache-Control", "public, max-age=86400");
    } else if (contentType.includes("video/") || contentType.includes("audio/")) {
      responseHeaders.set("Cache-Control", "public, max-age=3600");
    } else {
      responseHeaders.set("Cache-Control", "no-cache, no-store, must-revalidate");
    }
  }
  responseHeaders.set("Access-Control-Allow-Origin", "*");
  responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  responseHeaders.set("Access-Control-Allow-Headers", "*");
  responseHeaders.set("X-Content-Type-Options", "nosniff");
  return new Response(finalResponse.body, {
    status: finalResponse.status,
    statusText: finalResponse.statusText,
    headers: responseHeaders
  });
}
__name(proxyDirectUrl, "proxyDirectUrl");
var HEAD_LINK = `<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='12' fill='%2305070d'/><rect x='20' y='20' width='24' height='24' fill='none' stroke='%2300e5ff' stroke-width='3' transform='rotate(45 32 32)'/><circle cx='32' cy='32' r='4' fill='%2300ff9d'/></svg>"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500;600;700&family=Share+Tech+Mono&display=swap" rel="stylesheet">`;
var PAGE_STYLE = `
  :root{--bg-0:#05070d;--cyan:#00e5ff;--green:#00ff9d;--amber:#ffb454;--red:#ff5c7a;--text:#cfdfee;--dim:#5d7290;--bright:#eef6ff;--line:rgba(0,229,255,.18);--line-dim:rgba(120,150,190,.13);--fd:'Chakra Petch','Microsoft YaHei','PingFang SC',sans-serif;--fm:'Share Tech Mono','Consolas','Courier New',monospace;}
  *{box-sizing:border-box}
  html{-webkit-text-size-adjust:100%}
  body{font-family:var(--fd);line-height:1.65;color:var(--text);margin:0;min-height:100vh;overflow-x:hidden;background:radial-gradient(ellipse 90% 55% at 50% -12%,rgba(0,229,255,.09),transparent 70%),radial-gradient(ellipse 55% 40% at 95% 108%,rgba(0,255,157,.05),transparent 70%),var(--bg-0);}
  body::before{content:'';position:fixed;inset:0;z-index:-1;pointer-events:none;background-image:linear-gradient(rgba(0,229,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(0,229,255,.035) 1px,transparent 1px);background-size:44px 44px;-webkit-mask-image:radial-gradient(ellipse 75% 65% at 50% 30%,#000,transparent);mask-image:radial-gradient(ellipse 75% 65% at 50% 30%,#000,transparent);}
  .scanline{position:fixed;left:0;right:0;top:0;height:1px;z-index:9998;pointer-events:none;background:linear-gradient(90deg,transparent 2%,rgba(0,229,255,.35) 50%,transparent 98%);animation:scanMove 9s linear infinite;opacity:.5;}
  @keyframes scanMove{0%{transform:translateY(0)}100%{transform:translateY(100vh)}}
  @media(prefers-reduced-motion:reduce){.scanline{display:none}.card,.login-box{animation:none!important}}

  .container{max-width:1180px;margin:auto;padding:28px 20px;display:flex;flex-direction:column;gap:22px;}
  .card{position:relative;background:linear-gradient(160deg,rgba(13,20,40,.86),rgba(8,12,24,.92));backdrop-filter:blur(12px);padding:26px 28px;border-radius:4px;border:1px solid var(--line-dim);box-shadow:0 24px 60px rgba(0,0,0,.45);animation:riseIn .55s cubic-bezier(.2,.7,.3,1) backwards;}
  .container>.card:nth-child(2){animation-delay:.08s}
  .container>.card:nth-child(3){animation-delay:.16s}
  .container>.card:nth-child(4){animation-delay:.24s}
  .container>.card:nth-child(5){animation-delay:.32s}
  @keyframes riseIn{from{opacity:0;transform:translateY(16px)}}
  .card::before,.card::after{content:'';position:absolute;width:22px;height:22px;border:1px solid rgba(0,229,255,.5);pointer-events:none;transition:width .25s,height .25s,border-color .25s;}
  .card::before{top:-1px;left:-1px;border-right:none;border-bottom:none;}
  .card::after{bottom:-1px;right:-1px;border-left:none;border-top:none;}
  .card:hover::before,.card:hover::after{width:32px;height:32px;border-color:var(--cyan);}

  h1{margin:0;color:var(--bright);font-size:clamp(1.5em,4vw,2em);font-weight:700;letter-spacing:.06em;line-height:1.3;}
  h2{color:var(--bright);font-size:1.05em;font-weight:600;letter-spacing:.1em;margin:0 0 14px;padding-bottom:12px;border-bottom:1px solid var(--line-dim);position:relative;}
  h2::after{content:'';position:absolute;left:0;bottom:-1px;width:44px;height:1px;background:var(--cyan);box-shadow:0 0 8px var(--cyan);}
  .h2-en{float:right;color:#3a4d6b;font-family:var(--fm);font-size:11px;letter-spacing:.22em;font-weight:400;line-height:inherit;}
  code{font-family:var(--fm);background:rgba(0,229,255,.08);padding:3px 9px;border-radius:3px;color:var(--cyan);word-break:break-all;font-size:.88em;border:1px solid rgba(0,229,255,.14);}
  .muted{color:var(--dim);font-size:13.5px;}

  .stat-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px;margin:18px 0;}
  .stat-card{background:linear-gradient(170deg,rgba(0,229,255,.07),rgba(0,229,255,.02));border:1px solid rgba(0,229,255,.16);border-radius:4px;padding:18px 14px;text-align:center;position:relative;overflow:hidden;transition:transform .2s,box-shadow .2s;}
  .stat-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--cyan),transparent);opacity:.7;}
  .stat-card:hover{transform:translateY(-3px);box-shadow:0 14px 34px rgba(0,229,255,.13);}
  .stat-card>div:first-child{color:var(--dim);font-size:12px;letter-spacing:.15em;}
  .stat-val{font-family:var(--fm);font-size:clamp(1.8em,6vw,2.2em);color:var(--cyan);text-shadow:0 0 18px rgba(0,229,255,.45);margin-top:4px;}

  #domain-table-wrap,#daily-table,#adminDomainResult,#inviteList{overflow-x:auto;-webkit-overflow-scrolling:touch;}
  table{width:100%;border-collapse:collapse;font-size:13.5px;min-width:500px;}
  th,td{padding:11px 14px;text-align:left;border-bottom:1px solid rgba(120,150,190,.1);white-space:nowrap;}
  th{color:var(--cyan);font-family:var(--fm);font-weight:400;font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;background:rgba(0,229,255,.05);}
  td{font-family:var(--fm);}
  tbody tr:hover td{background:rgba(0,229,255,.03);}
  tr.best td{background:rgba(0,255,157,.07);}
  tr.best td:first-child{box-shadow:inset 3px 0 0 var(--green);}

  .tag{display:inline-flex;align-items:center;padding:2px 10px;border-radius:2px;font-size:11.5px;font-weight:600;letter-spacing:.08em;font-family:var(--fm);}
  .tag::before{content:'';width:5px;height:5px;border-radius:50%;margin-right:6px;background:currentColor;box-shadow:0 0 6px currentColor;}
  .tag-fast{background:rgba(0,255,157,.1);color:var(--green);border:1px solid rgba(0,255,157,.3);}
  .tag-good{background:rgba(0,229,255,.1);color:var(--cyan);border:1px solid rgba(0,229,255,.3);}
  .tag-slow{background:rgba(255,180,84,.1);color:var(--amber);border:1px solid rgba(255,180,84,.3);}
  .tag-timeout{background:rgba(255,92,122,.1);color:var(--red);border:1px solid rgba(255,92,122,.3);}

  .edge-box{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px;}
  .edge-item{background:rgba(5,8,16,.55);padding:14px 16px;border-radius:3px;font-size:13.5px;font-family:var(--fm);border:1px solid rgba(120,150,190,.1);border-left:2px solid rgba(0,229,255,.4);}
  .edge-item strong{color:var(--dim);display:block;margin-bottom:5px;font-size:10.5px;text-transform:uppercase;letter-spacing:.18em;font-weight:400;}

  .btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:11px 22px;color:#02141a;border-radius:2px;text-decoration:none;font-weight:600;border:none;cursor:pointer;font-size:13.5px;letter-spacing:.06em;font-family:var(--fd);position:relative;transition:all .18s;background:linear-gradient(135deg,#2eeaff 0%,#00b8d9 100%);clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px);filter:drop-shadow(0 4px 14px rgba(0,229,255,.22));}
  .btn:hover{background:linear-gradient(135deg,#7df3ff 0%,#00e5ff 100%);filter:drop-shadow(0 8px 22px rgba(0,229,255,.35));transform:translateY(-1px);}
  .btn:active{transform:translateY(0);}
  .btn:disabled{opacity:.5;cursor:not-allowed;filter:none;transform:none;}
  .btn-outline{background:rgba(0,229,255,.06);border:1px solid var(--line);color:var(--cyan);clip-path:none;filter:none;box-shadow:none;}
  .btn-outline:hover{background:rgba(0,229,255,.14);border-color:var(--cyan);filter:none;transform:translateY(-1px);}
  .btn-del{background:rgba(255,92,122,.08);border:1px solid rgba(255,92,122,.35);color:var(--red);clip-path:none;filter:none;box-shadow:none;}
  .btn-del:hover{background:rgba(255,92,122,.18);border-color:var(--red);filter:none;transform:translateY(-1px);}
  .btn-sm{padding:8px 15px;font-size:12.5px;}

  .warn{border:1px solid rgba(255,92,122,.4);border-left:3px solid var(--red);padding:16px 20px;border-radius:3px;color:#f2a5b5;background:rgba(255,92,122,.07);}

  input[type=password],input[type=text],input[type=url],select{width:100%;padding:13px 15px;border:1px solid var(--line-dim);border-radius:3px;background:rgba(5,9,18,.65);color:var(--bright);margin-bottom:15px;font-size:14px;font-family:var(--fd);transition:border-color .18s,box-shadow .18s;caret-color:var(--cyan);}
  input::placeholder{color:#44587a;}
  input:focus,select:focus{outline:none;border-color:var(--cyan);box-shadow:0 0 0 3px rgba(0,229,255,.1);}
  label{display:block;font-weight:600;margin-bottom:8px;font-size:12px;color:var(--dim);text-transform:uppercase;letter-spacing:.16em;}

  .toolbar{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;align-items:center;}

  .route-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(360px,100%),1fr));gap:16px;}
  .route-item{background:linear-gradient(165deg,rgba(13,20,40,.9),rgba(7,11,22,.95));border:1px solid var(--line-dim);border-radius:3px;padding:20px 22px;transition:all .25s;position:relative;overflow:hidden;}
  .route-item::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--cyan),transparent 70%);opacity:.5;transition:opacity .25s;}
  .route-item:hover{transform:translateY(-3px);border-color:rgba(0,229,255,.35);box-shadow:0 18px 44px rgba(0,0,0,.5);}
  .route-item:hover::before{opacity:1;}
  .route-header{display:flex;align-items:center;gap:12px;margin-bottom:14px;}
  .route-title{flex:1;}
  .route-name{font-size:1.14em;font-weight:600;color:var(--bright);margin:0 0 3px;letter-spacing:.02em;}
  .route-path{color:var(--cyan);font-family:var(--fm);font-size:.88em;}
  .route-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;padding-top:14px;border-top:1px solid rgba(120,150,190,.1);}
  .target-list{margin-top:10px;}
  .target-row{background:rgba(4,7,15,.6);border:1px solid rgba(120,150,190,.1);border-radius:3px;padding:10px 14px;margin-bottom:7px;display:flex;justify-content:space-between;align-items:center;gap:10px;transition:border-color .18s;font-size:12.5px;}
  .target-row:hover{border-color:rgba(0,229,255,.25);}
  .target-url{color:var(--dim);word-break:break-all;flex:1;}
  .target-latency{font-family:var(--fm);white-space:nowrap;}
  .route-meta{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px;}
  .meta-tag{font-size:10.5px;padding:3px 9px;background:rgba(120,150,190,.08);border:1px solid rgba(120,150,190,.15);border-radius:2px;color:var(--dim);font-family:var(--fm);letter-spacing:.05em;}
  .meta-tag-on{background:rgba(0,255,157,.08);border-color:rgba(0,255,157,.25);color:var(--green);}
  .meta-tag-warn{background:rgba(255,180,84,.1);border-color:rgba(255,180,84,.3);color:var(--amber);}

  .modal{display:none;position:fixed;inset:0;background:rgba(3,5,10,.82);backdrop-filter:blur(10px);z-index:1000;padding:20px;overflow:auto;animation:fadeIn .2s ease;}
  @keyframes fadeIn{from{opacity:0}}
  .modal.show{display:flex;align-items:center;justify-content:center;}
  .modal-inner{background:linear-gradient(170deg,rgba(13,20,40,.97),rgba(7,11,22,.98));padding:30px 32px;border-radius:4px;max-width:560px;width:100%;border:1px solid var(--line);box-shadow:0 30px 80px rgba(0,0,0,.6);animation:slideUp .3s cubic-bezier(.2,.7,.3,1);position:relative;}
  .modal-inner::before{content:'';position:absolute;top:-1px;left:-1px;width:26px;height:26px;border-top:1px solid var(--cyan);border-left:1px solid var(--cyan);}
  .modal-inner::after{content:'';position:absolute;bottom:-1px;right:-1px;width:26px;height:26px;border-bottom:1px solid var(--cyan);border-right:1px solid var(--cyan);}
  @keyframes slideUp{from{opacity:0;transform:translateY(24px)}}
  .modal-header{margin-bottom:22px;}
  .modal-title{font-size:1.25em;font-weight:600;color:var(--bright);margin:0;letter-spacing:.05em;}
  .modal-title::before{content:'//';color:var(--cyan);margin-right:.4em;font-family:var(--fm);}
  .modal-desc{color:var(--dim);font-size:13px;margin:8px 0 0;}
  .modal-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:26px;padding-top:18px;border-top:1px solid rgba(120,150,190,.12);}

  .search-box{position:relative;flex:1;min-width:200px;}
  .search-box input{margin-bottom:0;padding-left:40px;}
  .search-icon{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--dim);pointer-events:none;font-size:14px;}

  .empty-state{text-align:center;padding:44px 20px;color:var(--dim);grid-column:1/-1;}
  .empty-state-icon{display:block;width:44px;height:44px;margin:0 auto 16px;border:1.5px dashed rgba(0,229,255,.4);transform:rotate(45deg);opacity:.7;}
  .empty-state-text{font-size:1em;margin:0;}

  .form-group{margin-bottom:18px;}
  .form-group label{display:block;color:var(--dim);margin-bottom:8px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.16em;}
  .form-group input,.form-group select{width:100%;padding:13px 15px;border:1px solid var(--line-dim);border-radius:3px;background:rgba(5,9,18,.65);color:var(--bright);font-size:14px;transition:border-color .18s,box-shadow .18s;margin-bottom:0;font-family:var(--fd);}
  .form-group input:focus,.form-group select:focus{outline:none;border-color:var(--cyan);box-shadow:0 0 0 3px rgba(0,229,255,.1);}
  .form-hint{color:#46587a;font-size:12px;margin:8px 0 0;}
  .form-hint span{color:var(--cyan);font-family:var(--fm);}

  .checkbox-label{display:flex!important;align-items:center;gap:10px!important;text-transform:none!important;letter-spacing:normal!important;cursor:pointer;font-size:14px;color:var(--text);font-weight:400;}
  .checkbox-label input[type="checkbox"]{width:17px!important;height:17px;accent-color:var(--cyan);cursor:pointer;flex-shrink:0;}

  #toast{position:fixed;top:-70px;left:50%;transform:translateX(-50%);background:rgba(8,13,26,.95);backdrop-filter:blur(12px);color:var(--bright);padding:12px 26px;border-radius:3px;font-size:13.5px;letter-spacing:.04em;transition:top .4s cubic-bezier(.175,.885,.32,1.275);z-index:9999;border:1px solid var(--line);border-left:3px solid var(--cyan);box-shadow:0 14px 40px rgba(0,0,0,.5);}
  #toast.show{top:18px;}

  .target-inputs{display:flex;flex-direction:column;gap:10px;}
  .target-input-row{display:flex;gap:8px;align-items:center;}
  .target-input-row input{flex:1;margin-bottom:0;}
  .btn-remove{background:rgba(255,92,122,.08);border:1px solid rgba(255,92,122,.3);color:var(--red);padding:10px 14px;border-radius:3px;cursor:pointer;font-size:15px;flex-shrink:0;transition:background .18s;}
  .btn-remove:hover{background:rgba(255,92,122,.2);}

  .page-hero{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;}
  .brand{display:flex;align-items:center;gap:15px;min-width:0;}
  .brand-mark{width:44px;height:44px;position:relative;flex-shrink:0;}
  .brand-mark::before{content:'';position:absolute;inset:7px;border:1.5px solid var(--cyan);transform:rotate(45deg);box-shadow:0 0 16px rgba(0,229,255,.35),inset 0 0 8px rgba(0,229,255,.15);}
  .brand-mark::after{content:'';position:absolute;top:50%;left:50%;width:8px;height:8px;background:var(--green);transform:translate(-50%,-50%) rotate(45deg);box-shadow:0 0 12px var(--green);animation:pulseMark 2.4s ease-in-out infinite;}
  @keyframes pulseMark{50%{opacity:.3}}
  .brand-name{color:var(--bright);font-size:clamp(1.15em,3.5vw,1.4em);font-weight:600;letter-spacing:.08em;line-height:1.25;}
  .brand-sub{color:var(--dim);font-size:11px;font-family:var(--fm);letter-spacing:.16em;text-transform:uppercase;margin-top:2px;}
  .badge{display:inline-block;vertical-align:middle;font-family:var(--fm);font-size:11px;color:var(--cyan);border:1px solid rgba(0,229,255,.3);padding:1px 8px;border-radius:2px;letter-spacing:.1em;background:rgba(0,229,255,.06);margin-left:8px;}

  .login-title{text-align:center;font-size:1.4em;font-weight:700;color:var(--bright);letter-spacing:.32em;text-indent:.32em;margin:0 0 6px;}
  .login-sub{text-align:center;color:var(--dim);font-family:var(--fm);font-size:11px;letter-spacing:.26em;text-transform:uppercase;margin:0 0 26px;}
  .login-err{color:var(--red);font-size:13px;min-height:1.3em;margin:0 0 12px;font-family:var(--fm);}
  .login-link{text-align:center;margin:16px 0 0;font-size:13.5px;}
  .login-link a{color:var(--cyan);text-decoration:none;border-bottom:1px dashed rgba(0,229,255,.4);padding-bottom:1px;transition:all .18s;}
  .login-link a:hover{color:#7df3ff;border-bottom-style:solid;}

  @media(max-width:640px){
    .container{padding:16px 12px;gap:16px;}
    .card{padding:18px 16px;}
    .modal{padding:12px;}
    .modal-inner{padding:22px 18px;}
    table{font-size:12.5px;}
    th,td{padding:9px 10px;}
    .route-item{padding:16px;}
    .stat-card{padding:14px 10px;}
    .page-hero{align-items:flex-start;}
  }
`;
function buildFrontendHtml() {
  const domainListJson = JSON.stringify(OPTIMIZED_DOMAINS);
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Emby \u53CD\u4EE3 | \u667A\u80FD\u4F18\u9009</title>${HEAD_LINK}<style>${PAGE_STYLE}</style></head><body>
<div class="scanline"></div>
<div class="container">
  <div class="card">
    <div class="page-hero">
      <div class="brand">
        <div class="brand-mark"></div>
        <div>
          <div class="brand-name">EMBY PROXY<span class="badge">v${CURRENT_VERSION}</span></div>
          <div class="brand-sub">Cloudflare Edge \xB7 Intelligent Routing</div>
        </div>
      </div>
      <div style="display:flex;gap:10px;align-items:center"><a href="https://t.me/+7cbXthaBajszNjI1" target="_blank" rel="noopener" class="btn btn-outline btn-sm">\u4EA4\u6D41\u53CD\u9988</a><a href="/admin" class="btn btn-outline">\u63A7\u5236\u53F0</a></div>

    </div>
  </div>
  <div class="card">
    <h2>\u5F53\u524D\u8FB9\u7F18\u8282\u70B9<span class="h2-en">EDGE NODE</span></h2>
    <div id="edge-loading" class="muted">INITIALIZING...</div>
    <div id="edge-info" class="edge-box" style="display:none"></div>
  </div>
  <div class="card">
    <h2>\u4F18\u9009\u57DF\u540D\u6D4B\u901F<span class="h2-en">LATENCY SCAN</span></h2>
    <p class="muted" style="margin:0 0 14px">\u7528\u6237\u7F51\u7EDC \u2192 \u4F18\u9009\u5165\u53E3\u5EF6\u8FDF\uFF0C\u6309\u5EF6\u8FDF\u6392\u5E8F\uFF1B\u540C\u7F51\u6BB5 IP \u4E00\u5C0F\u65F6\u5185\u590D\u7528\u7F13\u5B58\u7ED3\u679C</p>
    <div class="toolbar" style="margin-bottom:14px"><button class="btn" id="btn-retest">\u91CD\u65B0\u6D4B\u901F</button><span id="speed-status" class="muted"></span></div>
    <div id="domain-table-wrap"><p class="muted" id="domain-loading">SCANNING...</p></div>
  </div>
  <div class="card">
    <h2>\u4F7F\u7528\u683C\u5F0F<span class="h2-en">QUICK START</span></h2>
    <p style="margin:0 0 12px"><code>https://\u4F60\u7684\u57DF\u540D/\u522B\u540D</code></p>
    <p style="margin:0 0 16px"><code>https://\u4F60\u7684\u57DF\u540D/https://emby.example.com:8096</code></p>
    <div class="warn">\u6DFB\u52A0\u670D\u52A1\u540E\u8BF7\u52A1\u5FC5\u624B\u52A8\u6D4B\u8BD5\u3002\u6076\u610F\u5237\u63A5\u53E3\u5C06\u5C01\u7981 IP\u3002</div>
  </div>
  <div class="card">
    <h2>\u4F7F\u7528\u7EDF\u8BA1\uFF08\u8FD130\u5929\uFF09<span class="h2-en">STATISTICS</span></h2>
    <div id="stats-loading" class="muted">LOADING...</div>
    <div id="stats-body" style="display:none">
      <div class="stat-row">
        <div class="stat-card"><div>\u64AD\u653E\u6B21\u6570</div><div class="stat-val" id="st-play">0</div></div>
        <div class="stat-card"><div>\u83B7\u53D6\u94FE\u63A5</div><div class="stat-val" id="st-pb">0</div></div>
      </div>
      <div id="daily-table"></div>
    </div>
  </div>
</div>
<script>
const OPT_DOMAINS = ${domainListJson};
const TAG = { fast:'\u6781\u5FEB', good:'\u826F\u597D', slow:'\u8F83\u6162', timeout:'\u8D85\u65F6' };
const CLS = { fast:'tag-fast', good:'tag-good', slow:'tag-slow', timeout:'tag-timeout' };

async function loadEdge() {
  try {
    const r = await fetch('/api/edge-info');
    const d = await r.json();
    document.getElementById('edge-loading').style.display = 'none';
    const box = document.getElementById('edge-info');
    box.style.display = 'grid';
    box.innerHTML = [
      ['\u5BA2\u6237\u7AEF IP', d.clientIp],
      ['\u63A5\u5165 POP', d.entryColo],
      ['\u56FD\u5BB6/\u5730\u533A', d.entryCountry + (d.entryCity ? ' / '+d.entryCity : '')],
      ['\u8FB9\u7F18\u51FA\u53E3 IP', d.edgeIp],
      ['\u843D\u5730 COLO', d.egressColo],
    ].map(([k,v]) => '<div class="edge-item"><strong>'+k+'</strong>'+ (v||'\u2014') +'</div>').join('');
  } catch(e) { document.getElementById('edge-loading').textContent = '\u52A0\u8F7D\u5931\u8D25'; }
}

function renderDomainTable(results, best) {
  const wrap = document.getElementById('domain-table-wrap');
  if (!results.length) { wrap.innerHTML = '<p class="muted">\u65E0\u6570\u636E</p>'; return; }
  let html = '<table><thead><tr><th>#</th><th>\u540D\u79F0</th><th>\u57DF\u540D</th><th>\u5EF6\u8FDF</th><th>\u72B6\u6001</th></tr></thead><tbody>';
  results.forEach((r, i) => {
    const host = r.host || (r.subdomain ? r.subdomain+'.'+r.domain : r.domain);
    const isBest = best && best === host;
    html += '<tr class="'+(isBest?'best':'')+'"><td>'+(i+1)+'</td><td>'+ (r.name||r.display_name||'') +'</td><td><code>'+host+'</code></td><td>'+(r.latency>=0?r.latency+' ms':'\u2014')+'</td><td><span class="tag '+CLS[r.status||'timeout']+'">'+(TAG[r.status]||'\u2014')+'</span></td></tr>';
  });
  wrap.innerHTML = html + '</tbody></table>';
}

function pingMs(url, timeout) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const timer = setTimeout(() => resolve(-1), timeout || 7000);
    const done = (ms) => { clearTimeout(timer); resolve(ms >= 0 && ms < (timeout || 7000) ? ms : -1); };
    fetch(url, { mode: 'no-cors', cache: 'no-store', credentials: 'omit' })
      .then(() => done(Math.round(performance.now() - t0)))
      .catch(() => {
        const img = new Image();
        const t1 = performance.now();
        const t2 = setTimeout(() => done(-1), 5000);
        const end = () => { clearTimeout(t2); done(Math.round(performance.now() - t1)); };
        img.onload = end;
        img.onerror = end;
        img.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + '_=' + Date.now();
      });
  });
}

async function probeDomain(item) {
  const host = item.subdomain ? item.subdomain + '.' + item.domain : item.domain;
  const paths = ['/cdn-cgi/trace', '/favicon.ico', '/'];
  for (const p of paths) {
    const ms = await pingMs('https://' + host + p, 7000);
    if (ms >= 0) {
      const status = ms < 100 ? 'fast' : ms < 300 ? 'good' : 'slow';
      return { subdomain: item.subdomain, domain: item.domain, name: item.name, host, latency: ms, status, source: 'client' };
    }
  }
  try {
    const r = await fetch('/api/ping-host?host=' + encodeURIComponent(host));
    const d = await r.json();
    if (d.ms >= 0) {
      const status = d.ms < 100 ? 'fast' : d.ms < 300 ? 'good' : 'slow';
      return { subdomain: item.subdomain, domain: item.domain, name: item.name, host, latency: d.ms, status, source: 'edge' };
    }
  } catch (_) {}
  return { subdomain: item.subdomain, domain: item.domain, name: item.name, host, latency: -1, status: 'timeout', source: 'none' };
}

function finalizeResults(rows) {
  const unique = new Map();
  rows.forEach(r => {
    const host = r.host || (r.subdomain ? r.subdomain+'.'+r.domain : r.domain);
    if (!unique.has(host)) unique.set(host, {...r, host});
  });
  rows.length = 0;
  rows.push(...unique.values());
  rows.forEach(r => { if (r.latency >= 0) r.status = r.latency < 100 ? 'fast' : r.latency < 300 ? 'good' : 'slow'; else r.status = 'timeout'; });
  rows.sort((a,b) => { if (a.latency<0) return 1; if (b.latency<0) return -1; return a.latency-b.latency; });
  return rows;
}

async function runDomainSpeed(force) {
  const st = document.getElementById('speed-status');
  const wrap = document.getElementById('domain-table-wrap');
  if (!force) {
    try {
      const cached = await fetch('/api/domains/speed');
      const data = await cached.json();
      if (data.cached && data.results?.length) {
        st.textContent = '\u5DF2\u4F7F\u7528\u7F13\u5B58\uFF08\u7EA61\u5C0F\u65F6\u6709\u6548\uFF09';
        renderDomainTable(data.results, data.best);
        return;
      }
    } catch(e) {}
  }
  st.textContent = '\u52A0\u8F7D\u8FB9\u7F18\u6D4B\u901F...';
  wrap.innerHTML = '<p class="muted">\u6D4B\u901F\u4E2D...</p>';
  let results = [];
  try {
    const er = await fetch('/api/domains/speed?edge=1');
    const ed = await er.json();
    if (ed.results?.length) {
      results = ed.results;
      finalizeResults(results);
      renderDomainTable(results, ed.best);
      st.textContent = '\u8FB9\u7F18\u6D4B\u901F\u5B8C\u6210\uFF0C\u6B63\u5728\u7528\u60A8\u7684\u7F51\u7EDC\u590D\u6D4B...';
    }
  } catch (_) {}
  const clientResults = await Promise.all(OPT_DOMAINS.map(probeDomain));
  finalizeResults(clientResults);
  const clientOk = clientResults.filter(r => r.latency >= 0).length;
  if (clientOk > 0) {
    results = clientResults;
    st.textContent = '\u6D4F\u89C8\u5668\u6D4B\u901F\u5B8C\u6210\uFF08' + clientOk + '/' + OPT_DOMAINS.length + ' \u53EF\u7528\uFF09';
    try {
      await fetch('/api/domains/speed', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ results }) });
    } catch(e) {}
  } else if (!results.length) {
    st.textContent = '\u6D4B\u901F\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u6216\u7A0D\u540E\u91CD\u8BD5';
  }
  const best = results.find(r => r.latency >= 0);
  renderDomainTable(results, best ? best.host : null);
  if (best && clientOk > 0) st.textContent += ' \xB7 \u63A8\u8350: ' + best.host;
}

async function loadStats() {
  try {
    const r = await fetch('/stats');
    const data = await r.json();
    if (data.error) { document.getElementById('stats-loading').textContent = data.error; return; }
    document.getElementById('stats-loading').style.display = 'none';
    document.getElementById('stats-body').style.display = 'block';
    document.getElementById('st-play').textContent = data.data.total.playing;
    document.getElementById('st-pb').textContent = data.data.total.playbackInfo;
    const daily = (data.data.dailyStats||[]).slice(0,10);
    let t = '<table><tr><th>\u65E5\u671F</th><th>\u64AD\u653E</th><th>\u94FE\u63A5</th></tr>';
    daily.forEach(s => { t += '<tr><td>'+s.date+'</td><td>'+s.playing_count+'</td><td>'+s.playback_info_count+'</td></tr>'; });
    document.getElementById('daily-table').innerHTML = t + '</table>';
  } catch(e) { document.getElementById('stats-loading').textContent = '\u7EDF\u8BA1\u52A0\u8F7D\u5931\u8D25'; }
}

document.getElementById('btn-retest').onclick = () => runDomainSpeed(true);
loadEdge(); runDomainSpeed(false); loadStats();
<\/script></body></html>`;
}
__name(buildFrontendHtml, "buildFrontendHtml");
function buildLoginHtml() {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>\u767B\u5F55</title>${HEAD_LINK}<style>${PAGE_STYLE}
body{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px;}
.login-box{position:relative;background:linear-gradient(170deg,rgba(13,20,40,.95),rgba(7,11,22,.97));padding:38px 34px 30px;border-radius:4px;max-width:400px;width:100%;border:1px solid var(--line);box-shadow:0 30px 80px rgba(0,0,0,.6),0 0 80px rgba(0,229,255,.06);animation:riseIn .5s ease backwards;}
.login-box::before,.login-box::after{content:'';position:absolute;width:26px;height:26px;border:1px solid var(--cyan);}
.login-box::before{top:-1px;left:-1px;border-right:none;border-bottom:none;}
.login-box::after{bottom:-1px;right:-1px;border-left:none;border-top:none;}
.login-box input{display:block;width:100%;box-sizing:border-box;margin-bottom:14px;}
@media(max-width:480px){.login-box{padding:30px 22px 24px;}}
</style></head><body><div class="scanline"></div><div class="login-box">
<div class="brand-mark" style="margin:0 auto 20px"></div>
<h1 class="login-title">\u7BA1\u7406\u5458\u767B\u5F55</h1>
<p class="login-sub">Admin Login</p>
<input type="text" id="loginUser" placeholder="\u7528\u6237\u540D (ADMIN_USERNAME)" autocomplete="username" onkeydown="if(event.key==='Enter')doLogin()">
<input type="password" id="loginPass" placeholder="\u5BC6\u7801 (ADMIN_PASSWORD)" autocomplete="current-password" onkeydown="if(event.key==='Enter')doLogin()">
<p id="loginErr" class="login-err"></p>
<button class="btn" style="width:100%" id="loginBtn" onclick="doLogin()">\u767B\u5F55</button>
<p class="login-link"><a href="/register">\u7528\u6237\u6CE8\u518C</a></p>
<script>
async function doLogin(){
  var u=document.getElementById('loginUser').value.trim();
  var p=document.getElementById('loginPass').value;
  var err=document.getElementById('loginErr');
  err.textContent='';
  if(!u||!p){err.textContent='\u8BF7\u586B\u5199\u7528\u6237\u540D\u548C\u5BC6\u7801';return;}
  document.getElementById('loginBtn').disabled=true;
  try{var r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p})});var d=await r.json();if(d.ok){location.href='/admin';return;}err.textContent=d.error||'\u767B\u5F55\u5931\u8D25';}catch(e){err.textContent='\u8BF7\u6C42\u5931\u8D25:'+e.message;}
  document.getElementById('loginBtn').disabled=false;
}
<\/script></div></body></html>`;
}
__name(buildLoginHtml, "buildLoginHtml");
function buildAdminHtml() {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>\u7BA1\u7406\u540E\u53F0</title>${HEAD_LINK}<style>${PAGE_STYLE}</style></head><body>
<div class="scanline"></div>
<div id="toast"></div>
<div class="container">
  <div class="card">
    <div class="page-hero">
      <div class="brand">
        <div class="brand-mark"></div>
        <div>
          <div class="brand-name">ADMIN CONSOLE</div>
          <div class="brand-sub">Route \xB7 Latency \xB7 Invite Management</div>
        </div>
      </div>
      <div style="display:flex;gap:10px">
        <a href="/" class="btn btn-outline btn-sm">\u9996\u9875</a>
        <button class="btn btn-del btn-sm" onclick="logout()">\u9000\u51FA</button>
      </div>
    </div>
  </div>

  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:16px">
      <h2 style="border:none;margin:0;padding:0;flex:1">\u8DEF\u7531\u7BA1\u7406<span class="h2-en" style="float:none;margin-left:12px">ROUTES</span></h2>
      <div class="toolbar" style="margin:0">
        <button class="btn" onclick="openRouteModal()">\u6DFB\u52A0\u8DEF\u7531</button>
        <button class="btn btn-outline" onclick="speedtestAll()">\u5168\u5C40\u6D4B\u901F</button>
        <div class="search-box">
          <span class="search-icon">\u2315</span>
          <input type="text" id="routeSearch" placeholder="\u641C\u7D22\u5907\u6CE8\u6216\u8DEF\u5F84..." oninput="filterRoutes()">
        </div>
      </div>
    </div>
    <div id="routeList" class="route-grid"><p class="muted">LOADING...</p></div>
  </div>

  <div class="card">
    <h2>\u4F18\u9009\u57DF\u540D\u6D4B\u901F<span class="h2-en">LATENCY SCAN</span></h2>
    <p class="muted" style="margin:0 0 14px">\u6D4B\u8BD5\u8FB9\u7F18\u8282\u70B9\u5230\u4F18\u9009\u5165\u53E3\u7684\u5EF6\u8FDF</p>
    <button class="btn" onclick="testDomains()">\u5F00\u59CB\u6D4B\u901F</button>
    <div id="adminDomainResult" style="margin-top:18px"></div>
  </div>

  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:12px">
      <h2 style="border:none;margin:0;padding:0;flex:1">\u9080\u8BF7\u7801\u7BA1\u7406<span class="h2-en" style="float:none;margin-left:12px">INVITE CODES</span></h2>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <select id="inviteCount" style="width:auto;margin-bottom:0;padding:10px 12px">
          <option value="1">\u751F\u6210 1 \u4E2A</option>
          <option value="5">\u751F\u6210 5 \u4E2A</option>
          <option value="10" selected>\u751F\u6210 10 \u4E2A</option>
          <option value="20">\u751F\u6210 20 \u4E2A</option>
        </select>
        <button class="btn" onclick="genInvites()">\u751F\u6210\u9080\u8BF7\u7801</button>
        <button class="btn btn-outline" onclick="copyUnusedInvites()">\u590D\u5236\u672A\u4F7F\u7528</button>
      </div>
    </div>
    <p class="muted" id="inviteSummary" style="margin:0 0 12px">LOADING...</p>
    <div id="inviteList" style="max-height:320px;overflow:auto"><p class="muted">LOADING...</p></div>
  </div>

  <div class="card">
    <h2>\u6570\u636E\u5E93\u7EF4\u62A4<span class="h2-en">DATABASE</span></h2>
    <div class="warn">\u91CD\u7F6E\u4F1A\u6E05\u7A7A\u8DEF\u7531\u3001\u7EDF\u8BA1\u3001\u6D4B\u901F\u7F13\u5B58\u3001\u9080\u8BF7\u7801\u3001\u7528\u6237\u548C\u7528\u6237\u57DF\u540D\u8BB0\u5F55\uFF0C\u4F46\u4E0D\u4F1A\u5220\u9664 D1 \u6570\u636E\u5E93\u5B9E\u4F8B\uFF0C\u4E5F\u4E0D\u4F1A\u4FEE\u6539\u7BA1\u7406\u5458\u73AF\u5883\u53D8\u91CF\u3002\u6B64\u64CD\u4F5C\u4E0D\u53EF\u64A4\u9500\u3002</div>
    <button class="btn btn-del" style="margin-top:16px" onclick="resetDatabase()">\u91CD\u7F6E\u6570\u636E\u5E93</button>
  </div>
</div>

<div id="modalRoute" class="modal">
  <div class="modal-inner">
    <div class="modal-header">
      <h2 class="modal-title" id="routeModalTitle">\u6DFB\u52A0\u8DEF\u7531</h2>
      <p class="modal-desc">\u521B\u5EFA\u8DEF\u7531\u540E\u53EF\u901A\u8FC7 /\u8DEF\u5F84 \u5FEB\u6377\u8BBF\u95EE\u76EE\u6807\u670D\u52A1</p>
    </div>
    <input type="hidden" id="oldPrefix">
    <div class="form-group">
      <label>\u5907\u6CE8\u540D</label>
      <input id="routeRemark" placeholder="\u4F8B\u5982\uFF1A\u6211\u7684 Emby \u670D\u52A1\u5668">
    </div>
    <div class="form-group">
      <label>\u8DEF\u5F84 (prefix)</label>
      <input id="routePrefix" placeholder="myemby">
      <p class="form-hint">\u8BBF\u95EE\u8DEF\u5F84: https://\u4F60\u7684\u57DF\u540D/<span id="prefixPreview">myemby</span></p>
    </div>
    <div class="form-group">
      <label>\u76EE\u6807\u7EBF\u8DEF (target)</label>
      <div id="targetInputs" class="target-inputs">
        <div class="target-input-row">
          <input type="url" class="target-url-input" placeholder="\u4E3B\u7EBF\u8DEF\u5730\u5740 (\u5982: https://emby.example.com:8096)">
          <button class="btn-remove" onclick="removeTargetInput(this)" title="\u79FB\u9664">\u2715</button>
        </div>
      </div>
      <button class="btn btn-outline btn-sm" style="margin-top:8px" onclick="addTargetInput()">\u6DFB\u52A0\u5907\u7528\u7EBF\u8DEF</button>
      <p class="form-hint">\u591A\u4E2A\u7EBF\u8DEF\u6309\u987A\u5E8F failover\uFF0C\u6D4B\u901F\u540E\u6309\u5EF6\u8FDF\u6392\u5E8F\u4F18\u9009</p>
    </div>
    <div class="form-group">
      <label class="checkbox-label">
        <input type="checkbox" id="routeCache" checked> \u542F\u7528\u56FE\u7247/\u9759\u6001\u8D44\u6E90\u7F13\u5B58
      </label>
      <label class="checkbox-label" style="margin-top:12px">
        <input type="checkbox" id="routeCompat"> \u517C\u5BB9\u6A21\u5F0F
      </label>
      <p class="form-hint">\u517C\u5BB9\u6A21\u5F0F\u9002\u7528\u4E8E\u90E8\u5206\u65E0\u6CD5\u6B63\u5E38\u64AD\u653E\u7684 Emby \u670D\u52A1\u5668\uFF0C\u5F00\u542F\u540E\u4E0D\u91CD\u5199\u5A92\u4F53\u6D41\u5730\u5740\uFF0C\u7531\u5BA2\u6237\u7AEF\u76F4\u8FDE\u6E90\u7AD9\u64AD\u653E</p>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeModal('modalRoute')">\u53D6\u6D88</button>
      <button class="btn" onclick="saveRoute()">\u4FDD\u5B58</button>
    </div>
  </div>
</div>

<script>
let allRoutes=[];

function closeModal(id){document.getElementById(id).classList.remove('show');}
function openModal(id){document.getElementById(id).classList.add('show');}

function logout(){document.cookie='admin_token=;path=/;max-age=0';location.reload();}

function showToast(msg){
  var t=document.getElementById('toast');
  if(!t){t=document.createElement('div');t.id='toast';document.body.appendChild(t);}
  t.textContent=msg;t.classList.add('show');
  setTimeout(function(){t.classList.remove('show');},2500);
}

function getLatencyInfo(ms){
  if(ms<0)return {text:'\u8D85\u65F6',cls:'tag-timeout',color:'#ff5c7a'};
  if(ms<100)return {text:'\u6781\u5FEB',cls:'tag-fast',color:'#00ff9d'};
  if(ms<300)return {text:'\u826F\u597D',cls:'tag-good',color:'#00e5ff'};
  return {text:'\u8F83\u6162',cls:'tag-slow',color:'#ffb454'};
}

function addTargetInput(){
  var container=document.getElementById('targetInputs');
  var row=document.createElement('div');
  row.className='target-input-row';
  row.innerHTML='<input type="url" class="target-url-input" placeholder="\u5907\u7528\u7EBF\u8DEF\u5730\u5740"><button class="btn-remove" onclick="removeTargetInput(this)" title="\u79FB\u9664">\u2715</button>';
  container.appendChild(row);
}

function removeTargetInput(btn){
  var container=document.getElementById('targetInputs');
  if(container.querySelectorAll('.target-input-row').length>1){
    btn.parentElement.remove();
  }
}

async function loadRoutes(){
  const r=await fetch('/admin/api/routes');
  if(r.status===401){location.reload();return;}
  allRoutes=await r.json();
  renderRoutes(allRoutes);
}

function parseLatencies(latStr){
  if(!latStr)return {};
  try{return JSON.parse(latStr);}catch(e){return {};}
}

function renderRoutes(list){
  const el=document.getElementById('routeList');
  if(!list.length){
    el.innerHTML='<div class="empty-state" style="grid-column:1/-1"><span class="empty-state-icon"></span><p class="empty-state-text">\u6682\u65E0\u8DEF\u7531\uFF0C\u70B9\u51FB\u4E0A\u65B9\u6309\u94AE\u6DFB\u52A0</p></div>';
    return;
  }
  el.innerHTML=list.map(r=>{
    const targets=r.target.split(',').map(s=>s.trim()).filter(Boolean);
    const latencies=parseLatencies(r.target_latencies);
    const remarkName=r.remark||'\u672A\u547D\u540D';
    const cacheStatus=r.cache_img!=='off';
    const compatStatus=r.compat_mode==='on';

    let targetsHtml='';
    targets.forEach((t,idx)=>{
      const lat=latencies[t];
      const latInfo=getLatencyInfo(lat);
      const tag=idx===0?'<span class="tag tag-fast">\u4E3B</span>':'<span class="tag tag-slow">\u5907'+idx+'</span>';
      const latDisplay=typeof lat==='number'&&lat>=0?'<span class="target-latency" style="color:'+latInfo.color+'">'+lat+'ms <span class="tag '+latInfo.cls+'">'+latInfo.text+'</span></span>':'<span class="target-latency" style="color:#5d7290">\u672A\u6D4B\u901F</span>';
      targetsHtml+='<div class="target-row">'+tag+' <span class="target-url"><code>'+t+'</code></span>'+latDisplay+'</div>';
    });

    return '<div class="route-item" data-search="'+(remarkName+' '+r.prefix).toLowerCase()+'">'+
      '<div class="route-header">'+
        '<div class="route-title">'+
          '<h3 class="route-name">'+remarkName+'</h3>'+
          '<span class="route-path">/'+r.prefix+'</span>'+
        '</div>'+
      '</div>'+
      '<div class="target-list">'+targetsHtml+'</div>'+
      '<div class="route-meta">'+
        (cacheStatus?'<span class="meta-tag meta-tag-on">\u7F13\u5B58 ON</span>':'<span class="meta-tag">\u7F13\u5B58 OFF</span>')+
        (compatStatus?'<span class="meta-tag meta-tag-warn">\u517C\u5BB9\u6A21\u5F0F</span>':'')+
        (r.last_play?'<span class="meta-tag">'+r.last_play+'</span>':'')+
      '</div>'+
      '<div class="route-actions">'+
        '<button class="btn btn-sm btn-outline" onclick="speedtestRoute(\\''+r.prefix+'\\')">\u6D4B\u901F</button>'+
        '<button class="btn btn-sm btn-outline" onclick="editRoute(\\''+r.prefix+'\\')">\u7F16\u8F91</button>'+
        '<button class="btn btn-sm btn-del" onclick="delRoute(\\''+r.prefix+'\\')">\u5220\u9664</button>'+
      '</div>'+
    '</div>';
  }).join('');
}

function filterRoutes(){
  const q=document.getElementById('routeSearch').value.toLowerCase();
  document.querySelectorAll('.route-item').forEach(c=>{
    c.style.display=(!q||c.dataset.search.includes(q))?'block':'none';
  });
}

function openRouteModal(){
  document.getElementById('oldPrefix').value='';
  document.getElementById('routeRemark').value='';
  document.getElementById('routePrefix').value='';
  document.getElementById('routeCache').checked=true;
  document.getElementById('routeCompat').checked=false;
  document.getElementById('prefixPreview').textContent='myemby';
  document.getElementById('routeModalTitle').textContent='\u6DFB\u52A0\u8DEF\u7531';
  var container=document.getElementById('targetInputs');
  container.innerHTML='<div class="target-input-row"><input type="url" class="target-url-input" placeholder="\u4E3B\u7EBF\u8DEF\u5730\u5740 (\u5982: https://emby.example.com:8096)"><button class="btn-remove" onclick="removeTargetInput(this)" title="\u79FB\u9664">\u2715</button></div>';
  openModal('modalRoute');
}

function editRoute(prefix){
  const r=allRoutes.find(x=>x.prefix===prefix);
  if(!r)return;
  document.getElementById('oldPrefix').value=r.prefix;
  document.getElementById('routeRemark').value=r.remark||'';
  document.getElementById('routePrefix').value=r.prefix;
  document.getElementById('routeCache').checked=r.cache_img!=='off';
  document.getElementById('routeCompat').checked=r.compat_mode==='on';
  document.getElementById('prefixPreview').textContent=r.prefix;
  document.getElementById('routeModalTitle').textContent='\u7F16\u8F91\u8DEF\u7531';

  var container=document.getElementById('targetInputs');
  container.innerHTML='';
  var targets=r.target.split(',').map(s=>s.trim()).filter(Boolean);
  targets.forEach(function(t){
    var row=document.createElement('div');
    row.className='target-input-row';
    row.innerHTML='<input type="url" class="target-url-input" value="'+t+'"><button class="btn-remove" onclick="removeTargetInput(this)" title="\u79FB\u9664">\u2715</button>';
    container.appendChild(row);
  });
  if(!targets.length){
    var row=document.createElement('div');
    row.className='target-input-row';
    row.innerHTML='<input type="url" class="target-url-input" placeholder="\u4E3B\u7EBF\u8DEF\u5730\u5740"><button class="btn-remove" onclick="removeTargetInput(this)" title="\u79FB\u9664">\u2715</button>';
    container.appendChild(row);
  }
  openModal('modalRoute');
}

async function saveRoute(){
  const oldPrefix=document.getElementById('oldPrefix').value;
  const remark=document.getElementById('routeRemark').value.trim();
  const prefix=document.getElementById('routePrefix').value.trim().replace(/^\\/+|\\/+$/g,'');
  const cache_img=document.getElementById('routeCache').checked?'on':'off';
  const compat_mode=document.getElementById('routeCompat').checked?'on':'off';

  var targetInputs=document.querySelectorAll('.target-url-input');
  var targets=[];
  targetInputs.forEach(function(inp){
    var val=inp.value.trim().replace(/\\/$/g,'');
    if(val)targets.push(val);
  });
  const target=targets.join(',');

  if(!prefix){showToast('\u8BF7\u8F93\u5165\u8DEF\u5F84');return;}
  if(!target){showToast('\u8BF7\u81F3\u5C11\u586B\u5199\u4E00\u4E2A\u4E3B\u7EBF\u8DEF\u5730\u5740');return;}

  document.getElementById('prefixPreview').textContent=prefix||'myemby';

  const r=await fetch('/admin/api/routes',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({oldPrefix:oldPrefix,prefix:prefix,target:target,remark:remark,cache_img:cache_img,compat_mode:compat_mode})
  });
  const j=await r.json();
  if(!r.ok){showToast(j.error||'\u4FDD\u5B58\u5931\u8D25');return;}
  closeModal('modalRoute');
  showToast('\u4FDD\u5B58\u6210\u529F');
  loadRoutes();
}

async function delRoute(prefix){
  if(!confirm('\u786E\u5B9A\u5220\u9664\u8DEF\u7531 /'+prefix+' \uFF1F'))return;
  await fetch('/admin/api/routes?prefix='+encodeURIComponent(prefix),{method:'DELETE'});
  showToast('\u5DF2\u5220\u9664');
  loadRoutes();
}

async function speedtestRoute(prefix){
  showToast('\u6D4B\u901F\u4E2D...');
  const r=await fetch('/admin/api/speedtest/routes?prefix='+encodeURIComponent(prefix),{method:'POST'});
  const d=await r.json();
  const ok=(d.results||[]).filter(x=>x.latency>=0).length;
  showToast('\u6D4B\u901F\u5B8C\u6210\uFF0C'+ok+'\u6761\u7EBF\u8DEF\u53EF\u7528');
  loadRoutes();
}

async function speedtestAll(){
  showToast('\u5168\u5C40\u6D4B\u901F\u4E2D\uFF0C\u8BF7\u8010\u5FC3\u7B49\u5F85...');
  const r=await fetch('/admin/api/speedtest/routes',{method:'POST'});
  const d=await r.json();
  showToast('\u5168\u5C40\u6D4B\u901F\u5B8C\u6210');
  loadRoutes();
}

async function testDomains(){
  document.getElementById('adminDomainResult').innerHTML='<p class="muted">\u6D4B\u901F\u4E2D...</p>';
  const r=await fetch('/admin/api/speedtest/domains',{method:'POST'});
  const d=await r.json();
  let h='<table><thead><tr><th>\u540D\u79F0</th><th>\u57DF\u540D</th><th>\u5EF6\u8FDF</th><th>\u72B6\u6001</th></tr></thead><tbody>';
  (d.results||[]).forEach(x=>{
    const status=getLatencyInfo(x.latency);
    h+='<tr'+(d.best===x.host?' class="best"':'')+'>'+
      '<td>'+(x.name||'\u2014')+'</td>'+
      '<td><code>'+x.host+'</code></td>'+
      '<td>'+(x.latency>=0?x.latency+'ms':'\u8D85\u65F6')+'</td>'+
      '<td><span class="tag '+status.cls+'">'+status.text+'</span></td>'+
    '</tr>';
  });
  document.getElementById('adminDomainResult').innerHTML=h+'</tbody></table>';
}

document.getElementById('routePrefix').addEventListener('input',function(){
  document.getElementById('prefixPreview').textContent=this.value.trim()||'myemby';
});

let inviteData=[];
async function loadInvites(){
  try{
    const r=await fetch('/admin/api/invites');
    const d=await r.json();
    if(!d.ok){document.getElementById('inviteList').innerHTML='<p class="muted">'+(d.error||'\u52A0\u8F7D\u5931\u8D25')+'</p>';return;}
    inviteData=d.codes||[];
    document.getElementById('inviteSummary').textContent='\u5171 '+d.total+' \u4E2A \xB7 \u5DF2\u4F7F\u7528 '+d.used+' \u4E2A \xB7 \u5269\u4F59 '+d.remaining+' \u4E2A\uFF08\u4E0A\u9650 50\uFF09';
    if(!inviteData.length){document.getElementById('inviteList').innerHTML='<p class="muted">\u8FD8\u6CA1\u6709\u9080\u8BF7\u7801\uFF0C\u70B9\u4E0A\u65B9\u6309\u94AE\u751F\u6210\u3002</p>';return;}
    let h='<table><thead><tr><th>\u9080\u8BF7\u7801</th><th>\u72B6\u6001</th><th>\u4F7F\u7528\u8005</th><th>\u751F\u6210\u65F6\u95F4</th><th>\u4F7F\u7528\u65F6\u95F4</th><th>\u64CD\u4F5C</th></tr></thead><tbody>';
    inviteData.forEach(c=>{
      var user=c.used_by_username?(c.used_by_username+' (ID '+c.used_by+')'):(c.used_by?'ID '+c.used_by:'\u2014');
      var action=c.status==='used'?'<button class="btn btn-sm btn-del" onclick="releaseInvite(\\''+c.code+'\\')">\u91CA\u653E</button>':'\u2014';
      h+='<tr><td><code>'+c.code+'</code></td><td>'+(c.status==='used'?'<span class="tag tag-slow">\u5DF2\u4F7F\u7528</span>':'<span class="tag tag-fast">\u672A\u4F7F\u7528</span>')+'</td><td>'+user+'</td><td>'+(c.created_at||'\u2014')+'</td><td>'+(c.used_at||'\u2014')+'</td><td>'+action+'</td></tr>';
    });
    document.getElementById('inviteList').innerHTML=h+'</tbody></table>';
  }catch(e){document.getElementById('inviteList').innerHTML='<p class="muted">\u52A0\u8F7D\u5931\u8D25: '+e.message+'</p>';}
}
async function genInvites(){
  const count=parseInt(document.getElementById('inviteCount').value)||10;
  const r=await fetch('/admin/api/invites/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({count})});
  const d=await r.json();
  if(d.ok){showToast('\u5DF2\u751F\u6210 '+d.generated+' \u4E2A');loadInvites();}
  else{showToast(d.error||'\u751F\u6210\u5931\u8D25');}
}
function copyUnusedInvites(){
  const unused=inviteData.filter(c=>c.status==='unused').map(c=>c.code);
  if(!unused.length){showToast('\u6CA1\u6709\u672A\u4F7F\u7528\u7684\u9080\u8BF7\u7801');return;}
  navigator.clipboard.writeText(unused.join('\\n')).then(()=>showToast('\u5DF2\u590D\u5236 '+unused.length+' \u4E2A\u9080\u8BF7\u7801')).catch(()=>showToast('\u590D\u5236\u5931\u8D25\uFF0C\u8BF7\u624B\u52A8\u9009\u62E9'));
}
async function releaseInvite(code){
  if(!confirm('\u786E\u5B9A\u91CA\u653E\u9080\u8BF7\u7801 '+code+'\uFF1F\u8FD9\u4F1A\u540C\u65F6\u5220\u9664\u8BE5\u9080\u8BF7\u7801\u7ED1\u5B9A\u7684\u7528\u6237\u8D26\u53F7\u548C DNS \u8BB0\u5F55\uFF0C\u4E4B\u540E\u9080\u8BF7\u7801\u548C\u7528\u6237\u540D\u90FD\u53EF\u4EE5\u518D\u6B21\u4F7F\u7528\u3002'))return;
  const r=await fetch('/admin/api/invites/release',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})});
  const d=await r.json();
  if(d.ok){
    showToast(d.dnsWarnings&&d.dnsWarnings.length?'\u9080\u8BF7\u7801\u548C\u7528\u6237\u5DF2\u91CA\u653E\uFF0C\u4F46\u6709 DNS \u6E05\u7406\u8B66\u544A':'\u9080\u8BF7\u7801\u548C\u7528\u6237\u5DF2\u91CA\u653E');
    loadInvites();
  }else{showToast(d.error||'\u91CA\u653E\u5931\u8D25');}
}
async function resetDatabase(){
  if(!confirm('\u786E\u5B9A\u91CD\u7F6E\u6570\u636E\u5E93\uFF1F\u6240\u6709\u4E1A\u52A1\u8868\u4F1A\u88AB\u5220\u9664\u5E76\u6309\u6700\u65B0\u7ED3\u6784\u91CD\u65B0\u521B\u5EFA\uFF0C\u7528\u6237\u3001\u9080\u8BF7\u7801\u3001\u8DEF\u7531\u3001\u7EDF\u8BA1\u548C\u7F13\u5B58\u90FD\u4F1A\u88AB\u6E05\u7A7A\u3002'))return;
  if(prompt('\u8BF7\u8F93\u5165 RESET DATABASE \u4EE5\u786E\u8BA4')!=='RESET DATABASE'){showToast('\u5DF2\u53D6\u6D88');return;}
  const r=await fetch('/admin/api/database/reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmation:'RESET DATABASE'})});
  const d=await r.json();
  if(d.ok){showToast(d.dnsWarnings&&d.dnsWarnings.length?'\u6570\u636E\u5E93\u5DF2\u91CD\u5EFA\uFF0C\u4F46\u6709 DNS \u6E05\u7406\u8B66\u544A':'\u6570\u636E\u5E93\u5DF2\u5220\u9664\u5E76\u91CD\u65B0\u521D\u59CB\u5316');loadRoutes();loadInvites();}else{showToast(d.error||'\u91CD\u7F6E\u5931\u8D25');}
}

loadRoutes();
loadInvites();
<\/script>
</body></html>`;
}
__name(buildAdminHtml, "buildAdminHtml");
var worker_default = {
  async fetch(request, env2, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "*"
        }
      });
    }
    if (env2.DB) {
      try {
        await initDatabase(env2);
      } catch (e) {
        console.error("Database initialization failed:", e);
        if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin/api/")) {
          return json({ ok: false, error: "\u6570\u636E\u5E93\u521D\u59CB\u5316\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5 D1 \u7ED1\u5B9A\u548C\u8868\u7ED3\u6784" }, 500);
        }
        throw e;
      }
    }
    if (url.pathname === "/__client_rtt__") {
      return new Response(null, {
        status: 204,
        headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" }
      });
    }
    if (url.pathname === "/") return html(buildFrontendHtml());
    if (url.pathname === "/favicon.ico") return new Response("", { headers: { "Content-Type": "image/x-icon" } });
    if (url.pathname.startsWith("/cdn-cgi/")) return new Response("Not Found", { status: 404 });
    if (url.pathname === "/health") {
      return json({ status: "ok", version: CURRENT_VERSION, colo: request.cf?.colo, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
    }
    if (url.pathname === "/stats") return handleStatsRequest(env2);
    if (url.pathname === "/api/edge-info") return json(await getEdgeInfo(request));
    if (url.pathname === "/api/ping-host") {
      const host = (url.searchParams.get("host") || "").replace(/^https?:\/\//, "").split("/")[0];
      if (!host) return json({ ms: -1, error: "missing host" });
      const ms = await speedtestUrl(`https://${host}/cdn-cgi/trace`, 5e3);
      return json({ ms, host });
    }
    if (url.pathname === "/api/domains/speed") {
      const cacheKey = getClientCacheKey(request);
      if (request.method === "GET") {
        if (url.searchParams.get("edge") === "1") {
          const data = await speedtestOptimizedFromEdge();
          const results = data.results.map((r) => ({
            subdomain: r.subdomain,
            domain: r.domain,
            name: r.name,
            host: r.host,
            latency: r.latency,
            status: r.status,
            source: "edge"
          }));
          return json({ cached: false, edge: true, best: data.best, results });
        }
        if (!env2.DB) return json({ cached: false, cacheKey, results: [] });
        const cached = await loadDomainSpeedCache(env2, cacheKey);
        if (cached) return json(cached);
        return json({ cached: false, cacheKey, results: [], domains: OPTIMIZED_DOMAINS });
      }
      if (request.method === "POST") {
        if (!env2.DB) return json({ success: false, error: "DB not bound" }, 500);
        const body = await request.json();
        const rows = (body.results || []).map((r) => ({
          subdomain: r.subdomain,
          domain: r.domain,
          name: r.name || r.display_name,
          latency: r.latency,
          status: r.status || latencyStatus(r.latency)
        }));
        await saveDomainSpeedCache(env2, cacheKey, rows);
        const best = rows.filter((r) => r.latency >= 0).sort((a, b) => a.latency - b.latency)[0];
        return json({ success: true, best: best ? `${best.subdomain}.${best.domain}` : null });
      }
    }
    if (url.pathname === "/admin/api/login" && request.method === "POST") {
      try {
        const body = await request.json();
        const username = (body.username || "").trim().toLowerCase();
        const password = body.password || "";
        return adminLoginResponse(request, env2, username, password);
      } catch (e) {
        return json({ ok: false, error: e.message }, 400);
      }
    }
    if (url.pathname === "/register" || url.pathname === "/register/") {
      return html(buildRegisterHtml());
    }
    if (url.pathname === "/api/register" && request.method === "POST") {
      if (!env2.DB) return json({ error: "DB \u672A\u7ED1\u5B9A" }, 500);
      try {
        const body = await request.json().catch(() => ({}));
        const username = (body.username || "").trim().toLowerCase();
        const password = body.password || "";
        const invite_code = (body.invite_code || "").trim();
        if (!username || username.length < 3 || username.length > 32 || !isDnsLabel(username)) return json({ error: "\u7528\u6237\u540D\u97003-32\u4F4D\u5C0F\u5199\u5B57\u6BCD\u3001\u6570\u5B57\u6216\u8FDE\u5B57\u7B26\uFF0C\u4E14\u4E0D\u80FD\u4EE5\u8FDE\u5B57\u7B26\u5F00\u5934\u6216\u7ED3\u5C3E" }, 400);
        if (RESERVED_SUBDOMAINS.includes(username)) return json({ error: "\u8BE5\u7528\u6237\u540D\u4E3A\u7CFB\u7EDF\u4FDD\u7559\u540D\u79F0\uFF0C\u4E0D\u53EF\u4F7F\u7528" }, 409);
        if (!password || password.length < 6) return json({ error: "\u5BC6\u7801\u81F3\u5C116\u4F4D" }, 400);
        if (!invite_code) return json({ error: "\u8BF7\u586B\u5199\u9080\u8BF7\u7801" }, 400);
        const dnsConfig = getDnsConfig(env2);
        if (!dnsConfig.zoneId || !dnsConfig.token) return json({ error: "DNS \u81EA\u52A8\u914D\u7F6E\u672A\u5B8C\u6210\uFF1A\u8BF7\u7BA1\u7406\u5458\u8BBE\u7F6E CF_DNS_API_TOKEN \u548C CF_ZONE_ID" }, 503);
        const existing = await env2.DB.prepare("SELECT id FROM users WHERE username = ?").bind(username).first();
        if (existing) return json({ error: "\u7528\u6237\u540D\u5DF2\u5B58\u5728" }, 409);
        const totalUsers = await env2.DB.prepare("SELECT COUNT(*) as c FROM users").first();
        if (totalUsers && totalUsers.c >= 50) return json({ error: "\u5DF2\u8FBE\u6700\u5927\u7528\u6237\u6570(50)" }, 409);
        const codeRow = await env2.DB.prepare("SELECT id FROM invite_codes WHERE code = ? AND status = 'unused'").bind(invite_code).first();
        if (!codeRow) return json({ error: "\u9080\u8BF7\u7801\u65E0\u6548\u6216\u5DF2\u4F7F\u7528" }, 400);
        const salt = genSalt();
        const hash = await hashPassword(password, salt);
        const initialRole = "user";
        let userId = null;
        let dnsCreated = false;
        let inviteMarkedUsed = false;
        try {
          const res = await env2.DB.prepare("INSERT INTO users (username, password_hash, salt, role) VALUES (?, ?, ?, ?)").bind(username, hash, salt, initialRole).run();
          userId = res.meta.last_row_id;
          const dns = await replaceUserDnsRecord(env2, username, DEFAULT_PREFERRED_HOST);
          dnsCreated = true;
          await env2.DB.prepare(
            "INSERT INTO user_domains (user_id, subdomain, preferred_host, remark, dns_record_id, dns_record_type) VALUES (?, ?, ?, ?, ?, ?)"
          ).bind(userId, username, dns.host, "\u6CE8\u518C\u81EA\u52A8\u521B\u5EFA", dns.recordId, dns.type).run();
          const token = await signSession(userId, env2);
          const inviteUpdate = await env2.DB.prepare(
            "UPDATE invite_codes SET status = 'used', used_by = ?, used_at = CURRENT_TIMESTAMP WHERE code = ? AND status = 'unused'"
          ).bind(userId, invite_code).run();
          if (!inviteUpdate.meta?.changes) throw new Error("\u9080\u8BF7\u7801\u5DF2\u88AB\u5176\u4ED6\u8BF7\u6C42\u4F7F\u7528\uFF0C\u8BF7\u66F4\u6362\u9080\u8BF7\u7801");
          inviteMarkedUsed = true;
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json", "Set-Cookie": setSessionCookie(token) }
          });
        } catch (e) {
          if (inviteMarkedUsed && userId !== null) {
            try {
              await env2.DB.prepare(
                "UPDATE invite_codes SET status = 'unused', used_by = NULL, used_at = NULL WHERE code = ? AND used_by = ?"
              ).bind(invite_code, userId).run();
            } catch (_) {
            }
          }
          if (userId !== null) {
            try {
              await env2.DB.prepare("DELETE FROM user_domains WHERE user_id = ?").bind(userId).run();
            } catch (_) {
            }
            try {
              await env2.DB.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();
            } catch (_) {
            }
          }
          if (dnsCreated) {
            try {
              await deleteUserDnsRecords(env2, username);
            } catch (_) {
            }
          }
          throw e;
        }
      } catch (e) {
        console.error("Registration failed:", e);
        const message = String(e?.message || "");
        if (message.includes("DNS") || message.includes("Cloudflare") || message.includes("\u9080\u8BF7\u7801\u5DF2\u88AB")) {
          return json({ ok: false, error: message }, 400);
        }
        const lowerMessage = message.toLowerCase();
        if (lowerMessage.includes("no such table") || lowerMessage.includes("no such column") || lowerMessage.includes("constraint") || lowerMessage.includes("database")) {
          return json({
            ok: false,
            error: `\u6CE8\u518C\u5931\u8D25\uFF1A\u6570\u636E\u5E93\u7ED3\u6784\u5F02\u5E38\uFF08${message.slice(0, 180)}\uFF09\uFF0C\u8BF7\u5728\u7BA1\u7406\u5458\u540E\u53F0\u91CD\u65B0\u6267\u884C\u201C\u91CD\u7F6E\u6570\u636E\u5E93\u201D`
          }, 500);
        }
        return json({ ok: false, error: `\u6CE8\u518C\u5931\u8D25\uFF1A${message.slice(0, 180) || "\u6570\u636E\u5E93\u64CD\u4F5C\u5F02\u5E38\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5"}` }, 500);
      }
    }
    if (url.pathname === "/api/login" && request.method === "POST") {
      if (!env2.DB) return json({ error: "DB \u672A\u7ED1\u5B9A" }, 500);
      const body = await request.json().catch(() => ({}));
      const username = (body.username || "").trim().toLowerCase();
      const password = body.password || "";
      if (!username || !password) return json({ error: "\u8BF7\u586B\u5199\u5B8C\u6574" }, 400);
      const adminUser = getAdminCredUser(env2);
      const adminPass = getAdminCredPass(env2);
      if (adminUser && adminPass && username === adminUser && password === adminPass) {
        const secure = url.protocol === "https:" ? "; Secure" : "";
        const cookie = `admin_token=${encodeURIComponent(adminPass)}; Path=/; Max-Age=2592000; SameSite=Lax${secure}`;
        return new Response(JSON.stringify({ ok: true, role: "admin" }), {
          status: 200,
          headers: { "Content-Type": "application/json", "Set-Cookie": cookie, "Cache-Control": "no-store" }
        });
      }
      const u = await env2.DB.prepare("SELECT id, username, password_hash, salt, role, status FROM users WHERE username = ?").bind(username).first();
      if (u && u.status === "active") {
        const hash = await hashPassword(password, u.salt);
        if (hash === u.password_hash) {
          let role = u.role;
          if (role !== "admin" && getAdminUsers(env2).includes(username)) {
            role = "admin";
            await env2.DB.prepare("UPDATE users SET role = 'admin' WHERE id = ?").bind(u.id).run();
          }
          const token = await signSession(u.id, env2);
          return new Response(JSON.stringify({ ok: true, role }), {
            status: 200,
            headers: { "Content-Type": "application/json", "Set-Cookie": setSessionCookie(token) }
          });
        }
      }
      return json({ error: "\u7528\u6237\u540D\u6216\u5BC6\u7801\u9519\u8BEF" }, 401);
    }
    if (url.pathname === "/api/logout") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json", "Set-Cookie": "user_token=; Path=/; Max-Age=0" }
      });
    }
    if (url.pathname === "/api/me") {
      if (!env2.DB) return json({ error: "DB \u672A\u7ED1\u5B9A" }, 500);
      const u = await getUser(request, env2);
      if (!u) return json({ error: "\u672A\u767B\u5F55" }, 401);
      return json({ ok: true, username: u.username, role: u.role });
    }
    if (url.pathname === "/api/user/routes" || url.pathname === "/api/user/speedtest/routes") {
      if (!env2.DB) return json({ error: "DB \u672A\u7ED1\u5B9A" }, 500);
      const u = await getUser(request, env2);
      if (!u) return json({ error: "\u672A\u767B\u5F55" }, 401);
      return handleUserRouteApi(request, env2, url, u);
    }
    if (url.pathname === "/api/user/domains" && request.method === "GET") {
      if (!env2.DB) return json({ error: "DB \u672A\u7ED1\u5B9A" }, 500);
      const u = await getUser(request, env2);
      if (!u) return json({ error: "\u672A\u767B\u5F55" }, 401);
      const rows = await env2.DB.prepare("SELECT subdomain, preferred_host, remark, status, dns_record_type FROM user_domains WHERE user_id = ? ORDER BY id").bind(u.id).all();
      return json({ ok: true, domains: rows.results || [] });
    }
    if (url.pathname === "/api/user/domains" && request.method === "POST") {
      if (!env2.DB) return json({ error: "DB \u672A\u7ED1\u5B9A" }, 500);
      const u = await getUser(request, env2);
      if (!u) return json({ error: "\u672A\u767B\u5F55" }, 401);
      const body = await request.json().catch(() => ({}));
      const subdomain = u.username;
      const preferred_host = normalizeDnsTarget(body.preferred_host);
      const remark = (body.remark || "").trim().slice(0, 200);
      if (!preferred_host) return json({ error: "\u4F18\u9009\u76EE\u6807\u5FC5\u987B\u662F\u5408\u6CD5\u57DF\u540D\u6216 IP" }, 400);
      const current = await env2.DB.prepare(
        "SELECT id, preferred_host FROM user_domains WHERE user_id = ? AND subdomain = ?"
      ).bind(u.id, subdomain).first();
      try {
        const dns = await replaceUserDnsRecord(env2, subdomain, preferred_host);
        if (current) {
          await env2.DB.prepare(
            "UPDATE user_domains SET preferred_host = ?, remark = ?, dns_record_id = ?, dns_record_type = ? WHERE id = ?"
          ).bind(preferred_host, remark, dns.recordId, dns.type, current.id).run();
        } else {
          await env2.DB.prepare(
            "INSERT INTO user_domains (user_id, subdomain, preferred_host, remark, dns_record_id, dns_record_type) VALUES (?, ?, ?, ?, ?, ?)"
          ).bind(u.id, subdomain, preferred_host, remark, dns.recordId, dns.type).run();
        }
        return json({ ok: true, dns: { name: dns.name, type: dns.type, content: dns.host } });
      } catch (e) {
        if (current?.preferred_host) {
          try {
            await replaceUserDnsRecord(env2, subdomain, current.preferred_host);
          } catch (_) {
          }
        }
        return json({ error: e.message || "DNS \u8BB0\u5F55\u66F4\u65B0\u5931\u8D25" }, 400);
      }
    }
    if (url.pathname === "/api/user/domains" && request.method === "DELETE") {
      if (!env2.DB) return json({ error: "DB \u672A\u7ED1\u5B9A" }, 500);
      const u = await getUser(request, env2);
      if (!u) return json({ error: "\u672A\u767B\u5F55" }, 401);
      const subdomain = url.searchParams.get("subdomain");
      if (!subdomain) return json({ error: "\u7F3A\u5C11 subdomain \u53C2\u6570" }, 400);
      if (subdomain.toLowerCase() === u.username) return json({ error: "\u6CE8\u518C\u7ED1\u5B9A\u7684\u8BBF\u95EE\u57DF\u540D\u4E0D\u80FD\u5220\u9664\uFF0C\u8BF7\u4FEE\u6539\u4F18\u9009\u76EE\u6807" }, 409);
      const row = await env2.DB.prepare("SELECT id FROM user_domains WHERE subdomain = ? AND user_id = ?").bind(subdomain, u.id).first();
      if (!row) return json({ error: "\u5B50\u57DF\u540D\u4E0D\u5B58\u5728" }, 404);
      await env2.DB.prepare("DELETE FROM user_domains WHERE id = ?").bind(row.id).run();
      return json({ ok: true });
    }
    if (url.pathname === "/admin" || url.pathname === "/admin/") {
      if (await hasAdminAccess(request, env2)) return html(buildAdminHtml());
      const u = env2.DB ? await getUser(request, env2) : null;
      if (u && u.role === "admin") return html(buildAdminHtml());
      if (u) return html(buildUserHtml(u, env2));
      return html(buildLoginHtml());
    }
    if (url.pathname.startsWith("/admin/api/")) {
      if (!await hasAdminAccess(request, env2)) return new Response("Unauthorized", { status: 401 });
      if (!env2.DB) return json({ error: "DB \u672A\u7ED1\u5B9A" }, 500);
      return handleAdminApi(request, env2, url);
    }
    const hostname = url.hostname.toLowerCase();
    const { publicEntryDomain, userBaseDomain } = getDomainConfig(env2);
    if (publicEntryDomain && hostname === publicEntryDomain) {
      const directProxy2 = parseDirectProxyTarget(url.pathname, url.search);
      if (directProxy2.matched) {
        if (directProxy2.error) return new Response(directProxy2.error, { status: 400 });
        return proxyDirectUrl(request, env2, ctx, [directProxy2.url], {
          enableCache: true,
          proxyPathPrefix: ""
        });
      }
    }
    if (hostname !== publicEntryDomain && userBaseDomain && hostname.endsWith("." + userBaseDomain) && hostname !== userBaseDomain) {
      const subdomain = hostname.slice(0, hostname.length - ("." + userBaseDomain).length);
      if (subdomain && subdomain.length >= 1 && subdomain.length <= 32 && /^[a-z0-9-]+$/.test(subdomain)) {
        if (env2.DB) {
          const row = await env2.DB.prepare("SELECT user_id, subdomain, preferred_host, remark, status FROM user_domains WHERE subdomain = ?").bind(subdomain).first();
          if (row && row.status === "active") {
            const directProxy2 = parseDirectProxyTarget(url.pathname, url.search);
            if (directProxy2.matched) {
              if (directProxy2.error) return new Response(directProxy2.error, { status: 400 });
              return proxyDirectUrl(request, env2, ctx, [directProxy2.url], {
                enableCache: true,
                // The target is explicit in the URL; do not override its DNS
                // resolution with the user's preferred host.
                proxyPathPrefix: ""
              });
            }
            const resolved2 = await resolveProxyTarget(request, env2, url, row.user_id);
            if (resolved2.error) return resolved2.error;
            return proxyDirectUrl(request, env2, ctx, resolved2.upstreamUrls, {
              enableCache: resolved2.enableCache,
              compatMode: resolved2.compatMode,
              matchedPrefix: resolved2.matchedPrefix,
              matchedRouteId: resolved2.matchedRouteId,
              matchedUserId: resolved2.matchedUserId,
              needsSpeedTest: resolved2.needsSpeedTest,
              preferredHost: row.preferred_host
            });
          }
          return new Response("\u5B50\u57DF\u540D\u4E0D\u5B58\u5728\u6216\u672A\u542F\u7528", { status: 404 });
        }
      }
    }
    const directProxy = parseDirectProxyTarget(url.pathname, url.search);
    if (directProxy.matched) {
      if (directProxy.error) return new Response(directProxy.error, { status: 400 });
      return proxyDirectUrl(request, env2, ctx, [directProxy.url], {
        enableCache: true,
        proxyPathPrefix: ""
      });
    }
    if (!env2.DB) {
      return new Response("D1 \u6570\u636E\u5E93\u672A\u7ED1\u5B9A\uFF0C\u8DEF\u7531\u53CD\u4EE3\u4E0D\u53EF\u7528\u3002\u4ECD\u53EF\u4F7F\u7528 /https://... \u683C\u5F0F\u3002", { status: 500 });
    }
    const resolved = await resolveProxyTarget(request, env2, url);
    if (resolved.error) return resolved.error;
    return proxyDirectUrl(request, env2, ctx, resolved.upstreamUrls, {
      enableCache: resolved.enableCache,
      compatMode: resolved.compatMode,
      matchedPrefix: resolved.matchedPrefix,
      matchedRouteId: resolved.matchedRouteId,
      matchedUserId: resolved.matchedUserId,
      needsSpeedTest: resolved.needsSpeedTest
    });
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
