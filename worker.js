var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../../../../AppData/Roaming/npm/node_modules/wrangler/node_modules/unenv/dist/runtime/_internal/utils.mjs
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

// ../../../../AppData/Roaming/npm/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/perf_hooks/performance.mjs
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

// ../../../../AppData/Roaming/npm/node_modules/wrangler/node_modules/@cloudflare/unenv-preset/dist/runtime/polyfill/performance.mjs
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

// ../../../../AppData/Roaming/npm/node_modules/wrangler/node_modules/unenv/dist/runtime/node/console.mjs
import { Writable } from "node:stream";

// ../../../../AppData/Roaming/npm/node_modules/wrangler/node_modules/unenv/dist/runtime/mock/noop.mjs
var noop_default = Object.assign(() => {
}, { __unenv__: true });

// ../../../../AppData/Roaming/npm/node_modules/wrangler/node_modules/unenv/dist/runtime/node/console.mjs
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

// ../../../../AppData/Roaming/npm/node_modules/wrangler/node_modules/@cloudflare/unenv-preset/dist/runtime/node/console.mjs
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

// ../../../../AppData/Roaming/npm/node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-console
globalThis.console = console_default;

// ../../../../AppData/Roaming/npm/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/process/hrtime.mjs
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

// ../../../../AppData/Roaming/npm/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/process/process.mjs
import { EventEmitter } from "node:events";

// ../../../../AppData/Roaming/npm/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/tty/read-stream.mjs
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

// ../../../../AppData/Roaming/npm/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/tty/write-stream.mjs
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

// ../../../../AppData/Roaming/npm/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/process/node-version.mjs
var NODE_VERSION = "22.14.0";

// ../../../../AppData/Roaming/npm/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/process/process.mjs
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

// ../../../../AppData/Roaming/npm/node_modules/wrangler/node_modules/@cloudflare/unenv-preset/dist/runtime/node/process.mjs
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

// ../../../../AppData/Roaming/npm/node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-process
globalThis.process = process_default;

// worker.js
var CURRENT_VERSION = "v6.8.4-multi";
var DEFAULT_OPTIMIZED_DOMAINS = [
  { domain: "youxuan.cf.090227.xyz", name: "CF\u4F18\u9009-090227", isBuiltin: true },
  { domain: "cf.877774.xyz", name: "\u79CB\u540D\u5C71\u4F18\u9009", isBuiltin: true },
  { domain: "cf.cf.cnae.top", name: "NB\u4F18\u9009", isBuiltin: true },
  { domain: "saas.sin.fan", name: "MIYU\u4F18\u9009", isBuiltin: true },
  { domain: "bestcf.030101.xyz", name: "Mingyu\u4F18\u9009", isBuiltin: true },
  { domain: "cf.cloudflare.182682.xyz", name: "WeTest\u4F18\u9009", isBuiltin: true },
  { domain: "cf.tencentapp.cn", name: "\u65E0\u540D\u6C0F\u7EF4\u62A4\u57DF\u540D", isBuiltin: true },
  { domain: "mfa.gov.ua", name: "\u4E4C\u514B\u5170\u5916\u4EA4\u90E8", isBuiltin: true },
  { domain: "www.shopify.com", name: "Shopify\u5B98\u65B9", isBuiltin: true },
  { domain: "store.ubi.com", name: "\u80B2\u78A7\u5546\u5E97", isBuiltin: true },
  { domain: "staticdelivery.nexusmods.com", name: "NexusMods", isBuiltin: true }
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
var DEFAULT_USER_ROUTE_LIMIT = 20;
var DEFAULT_USER_DNS_TARGET = "youxuan.cf.090227.xyz";
var USERNAME_RE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;
var RESERVED_PREFIXES = /* @__PURE__ */ new Set([
  "admin",
  "api",
  "stats",
  "health",
  "register",
  "login",
  "logout",
  "favicon.ico",
  "robots.txt",
  "cdn-cgi",
  ".well-known",
  "assets",
  "static"
]);
var RESERVED_SUBDOMAINS = /* @__PURE__ */ new Set([
  "admin",
  "api",
  "www",
  "mail",
  "smtp",
  "ftp",
  "ns",
  "ns1",
  "ns2",
  "dns",
  "proxy",
  "stats",
  "health",
  "register",
  "login",
  "logout",
  "cdn",
  "static",
  "test",
  "dev",
  "staging",
  "root",
  "support",
  "help",
  "status"
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
var DOMAIN_PROXY_RULES = {};
var JP_COLOS = ["NRT", "KIX", "FUK", "OKA"];
var CONFIG = {
  enableStats: true
};
var UPSTREAM_FAILOVER_STATUSES = Object.freeze([502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 527, 530]);
var CF_ORIGIN_ERROR_STATUSES = Object.freeze([520, 521, 522, 523, 524, 525, 526, 527, 530]);
var SECURITY_HEADERS = Object.freeze({
  "Referrer-Policy": "origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=15552000; preload",
  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
  "X-XSS-Protection": "1; mode=block"
});
var DROP_REQUEST_HEADERS = Object.freeze(/* @__PURE__ */ new Set([
  "host",
  "x-real-ip",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "forwarded",
  "connection",
  "upgrade",
  "transfer-encoding",
  "te",
  "keep-alive",
  "proxy-authorization",
  "proxy-authenticate",
  "trailer",
  "expect"
]));
var CLIENT_IDENTITY_HEADERS = Object.freeze(/* @__PURE__ */ new Set([
  "cf-connecting-ip",
  "cf-ipcountry",
  "cf-worker",
  "true-client-ip",
  "x-real-ip",
  "x-forwarded-for",
  "forwarded",
  "x-cluster-client-ip",
  "client-ip"
]));
var IP_MODES = Object.freeze(["forward", "strip", "disable"]);
function normalizeIpMode(v) {
  const m = String(v || "").trim().toLowerCase();
  return IP_MODES.includes(m) ? m : "forward";
}
__name(normalizeIpMode, "normalizeIpMode");
function stripClientIdentityHeaders(headers) {
  for (const h of CLIENT_IDENTITY_HEADERS) headers.delete(h);
}
__name(stripClientIdentityHeaders, "stripClientIdentityHeaders");
var DROP_RESPONSE_HEADERS = Object.freeze(/* @__PURE__ */ new Set([
  "access-control-allow-origin",
  "access-control-allow-methods",
  "access-control-allow-headers",
  "access-control-allow-credentials",
  "x-frame-options",
  "strict-transport-security",
  "x-content-type-options",
  "x-xss-protection",
  "referrer-policy",
  "x-powered-by",
  "server"
]));
var REQUEST_PATTERNS = Object.freeze({
  imageExt: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
  staticExt: /\.(?:js|css|woff2?|ttf|otf|map|webmanifest)$/i,
  subtitleExt: /\.(?:srt|ass|vtt|sub)$/i,
  embyImages: /(?:\/Images\/|\/Icons\/|\/Branding\/|\/emby\/covers\/)/i,
  manifestExt: /\.(?:m3u8|mpd)$/i,
  segmentExt: /\.(?:ts|m4s)$/i,
  streaming: /\.(?:mp4|m4v|m4a|ogv|webm|mkv|mov|avi|wmv|flv)$/i
});
var progressMap = /* @__PURE__ */ new Map();
var PROGRESS_THROTTLE_MS = 3e4;
var PROGRESS_MAP_MAX = 1e4;
var CORS_JSON = { "Content-Type": "application/json; charset=utf-8" };
var dbReady = false;
function classifyRequest(pathname, method) {
  if (REQUEST_PATTERNS.embyImages.test(pathname)) return "image";
  if (REQUEST_PATTERNS.manifestExt.test(pathname)) return "manifest";
  if (REQUEST_PATTERNS.segmentExt.test(pathname)) return "segment";
  if (REQUEST_PATTERNS.streaming.test(pathname)) return "streaming";
  if (REQUEST_PATTERNS.subtitleExt.test(pathname)) return "subtitle";
  if (REQUEST_PATTERNS.imageExt.test(pathname)) return "image";
  if (REQUEST_PATTERNS.staticExt.test(pathname)) return "static";
  if (/\/PlaybackInfo/i.test(pathname)) return "playback_info";
  if (/\/Sessions\/Playing/i.test(pathname)) return "playing";
  if (/\/emby\/(Sessions|Items|Users|System)/i.test(pathname)) return "api";
  return "other";
}
__name(classifyRequest, "classifyRequest");
function isCacheableRequest(category) {
  return category === "image" || category === "static";
}
__name(isCacheableRequest, "isCacheableRequest");
function formatBytes(bytes) {
  const b = Math.max(0, Number(bytes) || 0);
  if (!b) return "0 B";
  const k = 1024, sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return parseFloat((b / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
__name(formatBytes, "formatBytes");
function getShanghaiParts(ts = Date.now()) {
  const d = new Date(ts + 8 * 36e5);
  const iso = d.toISOString();
  return { dateKey: iso.slice(0, 10), hour: d.getUTCHours(), ts };
}
__name(getShanghaiParts, "getShanghaiParts");
function getResponseBytes(response) {
  if (!response) return 0;
  const cl = response.headers.get("content-length");
  if (cl) {
    const n = parseInt(cl, 10);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return 0;
}
__name(getResponseBytes, "getResponseBytes");
function toGraphQLStr(v) {
  return JSON.stringify(String(v ?? ""));
}
__name(toGraphQLStr, "toGraphQLStr");
async function cfFetchGraphql(apiToken, query) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 12e3);
  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      signal: ctrl.signal
    });
    if (!res.ok) throw new Error(`cf_http_${res.status}`);
    const data = await res.json();
    if (Array.isArray(data?.errors) && data.errors.length) throw new Error(data.errors.map((e) => e?.message).filter(Boolean).join("; ") || "cf_graphql_error");
    return data;
  } finally {
    clearTimeout(tid);
  }
}
__name(cfFetchGraphql, "cfFetchGraphql");
async function cfGetZoneAnalytics(cfZoneId, cfApiToken, startIso, endIso, useHostDim = true) {
  const dims = useHostDim ? "datetimeHour clientRequestHTTPHost" : "datetimeHour";
  const query = `query { viewer { zones(filter: { zoneTag: ${toGraphQLStr(cfZoneId)} }) { series: httpRequestsAdaptiveGroups(limit: 10000, filter: { datetime_geq: ${toGraphQLStr(startIso)}, datetime_leq: ${toGraphQLStr(endIso)} }) { count dimensions { ${dims} } sum { edgeResponseBytes visits } } } } }`;
  const data = await cfFetchGraphql(cfApiToken, query);
  return data?.data?.viewer?.zones?.[0] || null;
}
__name(cfGetZoneAnalytics, "cfGetZoneAnalytics");
async function cfGetWorkerRequests(cfAccountId, cfApiToken, startIso, endIso) {
  const query = `query { viewer { accounts(filter: { accountTag: ${toGraphQLStr(cfAccountId)} }) { workersInvocationsAdaptive(limit: 10000, filter: { datetime_geq: ${toGraphQLStr(startIso)}, datetime_leq: ${toGraphQLStr(endIso)} }) { dimensions { datetime scriptName status } sum { requests } } } } }`;
  const data = await cfFetchGraphql(cfApiToken, query);
  return data?.data?.viewer?.accounts?.[0] || null;
}
__name(cfGetWorkerRequests, "cfGetWorkerRequests");
async function cfGetAccountHttp(cfAccountId, cfApiToken, startIso, endIso, useHostDim = true) {
  const dims = useHostDim ? "datetimeHour clientRequestHTTPHost" : "datetimeHour";
  const query = `query { viewer { accounts(filter: { accountTag: ${toGraphQLStr(cfAccountId)} }) { series: httpRequestsAdaptiveGroups(limit: 10000, filter: { datetime_geq: ${toGraphQLStr(startIso)}, datetime_leq: ${toGraphQLStr(endIso)} }) { count dimensions { ${dims} } sum { edgeResponseBytes visits } } } } }`;
  const data = await cfFetchGraphql(cfApiToken, query);
  return data?.data?.viewer?.accounts?.[0] || null;
}
__name(cfGetAccountHttp, "cfGetAccountHttp");
function dayRangeIso(dateKey) {
  const start = (/* @__PURE__ */ new Date(dateKey + "T00:00:00+08:00")).getTime();
  return { start: new Date(start).toISOString(), end: new Date(start + 864e5 - 1).toISOString() };
}
__name(dayRangeIso, "dayRangeIso");
var workerHostCache = { at: 0, key: "", set: null };
async function getWorkerHosts(env2) {
  const userDomain = getUserDomain(env2);
  const main = getStatsHost(env2);
  const cacheKey = (userDomain || "") + "|" + (main || "") + "|" + (env2.DB ? "db" : "nodb");
  if (workerHostCache.set && workerHostCache.key === cacheKey && Date.now() - workerHostCache.at < 6e4) {
    return workerHostCache.set;
  }
  const set = /* @__PURE__ */ new Set();
  for (const h of envStr(env2, "STATS_HOSTS").split(/[\s,]+/).filter(Boolean)) set.add(h.toLowerCase());
  if (main) set.add(main);
  if (env2.DB && userDomain) {
    try {
      const { results } = await env2.DB.prepare("SELECT username, subdomain FROM users").all();
      for (const u of results || []) {
        const sub = String(u?.subdomain || u?.username || "").trim().toLowerCase();
        if (sub) set.add(sub + "." + userDomain);
      }
    } catch (_) {
    }
  }
  workerHostCache.at = Date.now();
  workerHostCache.key = cacheKey;
  workerHostCache.set = set;
  return set;
}
__name(getWorkerHosts, "getWorkerHosts");
function makeHostMatcher(env2, hostSet) {
  const userDomain = String(getUserDomain(env2) || "").toLowerCase();
  const main = String(getStatsHost(env2) || "").toLowerCase();
  return (raw) => {
    const h = String(raw || "").toLowerCase().replace(/:\d+$/, "");
    if (!h) return false;
    if (hostSet && hostSet.has(h)) return true;
    if (main && h === main) return true;
    if (userDomain && (h === userDomain || h.endsWith("." + userDomain))) return true;
    return false;
  };
}
__name(makeHostMatcher, "makeHostMatcher");
async function cfGetZoneSummary(env2, dateKey, hostSet = null) {
  const token = getCFApiToken(env2);
  if (!token) return { error: "\u672A\u914D\u7F6E CF_API_TOKEN" };
  let info3;
  try {
    info3 = await resolveZoneInfo(env2);
  } catch (e) {
    return { error: String(e?.message || e) };
  }
  if (!info3.zoneId) return { error: info3.error || "\u672A\u89E3\u6790\u5230 CF_ZONE_ID" };
  const { start, end } = dayRangeIso(dateKey);
  let zone = null;
  let hostDim = true;
  let firstError = "";
  try {
    zone = await cfGetZoneAnalytics(info3.zoneId, token, start, end, true);
  } catch (e) {
    firstError = String(e?.message || e);
    hostDim = false;
    try {
      zone = await cfGetZoneAnalytics(info3.zoneId, token, start, end, false);
    } catch (e2) {
      return { error: String(e2?.message || e2).slice(0, 240) };
    }
  }
  if (!zone?.series) return { error: "CF \u672A\u8FD4\u56DE\u6570\u636E\uFF08Token \u53EF\u80FD\u7F3A\u5C11 Analytics:Read \u6743\u9650\uFF09" };
  const statsHost = getStatsHost(env2);
  const wanted = hostSet && hostSet.size ? makeHostMatcher(env2, hostSet) : statsHost ? makeHostMatcher(env2, /* @__PURE__ */ new Set([statsHost])) : null;
  const matches = /* @__PURE__ */ __name((item) => {
    if (!wanted) return true;
    return wanted(item?.dimensions?.clientRequestHTTPHost);
  }, "matches");
  const rows = hostDim ? zone.series.filter(matches) : zone.series;
  let hostMatched = true;
  let useRows = rows;
  if (hostDim && wanted && rows.length === 0) {
    hostMatched = false;
    useRows = hostSet ? [] : zone.series;
  }
  const sumRows = /* @__PURE__ */ __name((list) => {
    let requests = 0, visits = 0, bytes = 0;
    const hourly = Array.from({ length: 24 }, () => 0);
    for (const item of list) {
      const n = Number(item?.count) || 0;
      requests += n;
      visits += Number(item?.sum?.visits) || 0;
      bytes += Number(item?.sum?.edgeResponseBytes) || 0;
      const raw = item?.dimensions?.datetimeHour;
      if (raw) {
        const h = (new Date(raw).getUTCHours() + 8) % 24;
        if (h >= 0 && h < 24) hourly[h] += n;
      }
    }
    return { requests, visits, bytes, hourly };
  }, "sumRows");
  const total = sumRows(useRows);
  const mainRows = hostDim && statsHost ? zone.series.filter((it) => String(it?.dimensions?.clientRequestHTTPHost || "").toLowerCase() === statsHost) : useRows;
  const main = sumRows(mainRows);
  return {
    requests: total.requests,
    visits: total.visits,
    bytes: total.bytes,
    hourly: total.hourly,
    mainRequests: main.requests,
    mainVisits: main.visits,
    mainBytes: main.bytes,
    zoneId: info3.zoneId,
    zoneName: info3.zoneName,
    statsHost,
    hostMatched,
    hostDim,
    note: hostMatched ? "" : "CF \u4E2D\u672A\u627E\u5230 " + (statsHost || "Worker \u57DF\u540D") + " \u7684\u6570\u636E\uFF0C\u5F53\u524D\u5C55\u793A\u6574\u4E2A Zone \u6C47\u603B\uFF1B\u8BF7\u68C0\u67E5 DNS_RECORD_NAME / STATS_HOSTS",
    warning: firstError ? "\u6309\u57DF\u540D\u5206\u7EC4\u67E5\u8BE2\u5931\u8D25\uFF0C\u5DF2\u9000\u56DE Zone \u6C47\u603B: " + firstError.slice(0, 120) : ""
  };
}
__name(cfGetZoneSummary, "cfGetZoneSummary");
async function cfGetZoneDailySeries(env2, days = 7) {
  const token = getCFApiToken(env2);
  if (!token) return { error: "\u672A\u914D\u7F6E CF_API_TOKEN" };
  let info3;
  try {
    info3 = await resolveZoneInfo(env2);
  } catch (e) {
    return { error: String(e?.message || e) };
  }
  if (!info3.zoneId) return { error: info3.error || "\u672A\u89E3\u6790\u5230 CF_ZONE_ID" };
  const today = getShanghaiParts().dateKey;
  const startDate = new Date((/* @__PURE__ */ new Date(today + "T00:00:00Z")).getTime() - (days - 1) * 864e5).toISOString().slice(0, 10);
  const start = (/* @__PURE__ */ new Date(startDate + "T00:00:00+08:00")).toISOString();
  const end = new Date((/* @__PURE__ */ new Date(today + "T00:00:00+08:00")).getTime() + 864e5 - 1).toISOString();
  const statsHost = getStatsHost(env2);
  const buildQuery = /* @__PURE__ */ __name((hostFilter) => {
    const hostPart = hostFilter ? `, clientRequestHTTPHost: ${toGraphQLStr(hostFilter)}` : "";
    return `query { viewer { zones(filter: { zoneTag: ${toGraphQLStr(info3.zoneId)} }) { series: httpRequestsAdaptiveGroups(limit: 10000, filter: { datetime_geq: ${toGraphQLStr(start)}, datetime_leq: ${toGraphQLStr(end)}${hostPart} }) { count dimensions { datetimeHour clientRequestHTTPHost } sum { edgeResponseBytes visits } } } } }`;
  }, "buildQuery");
  let rows = null;
  let hostFilterUsed = false;
  if (statsHost) {
    try {
      const zone = await cfFetchGraphql(token, buildQuery(statsHost));
      const r = zone?.data?.viewer?.zones?.[0]?.series;
      if (Array.isArray(r)) {
        rows = r;
        hostFilterUsed = true;
      }
    } catch (_) {
    }
  }
  if (!hostFilterUsed) {
    try {
      const zone = await cfFetchGraphql(token, buildQuery(""));
      const r = zone?.data?.viewer?.zones?.[0]?.series;
      if (Array.isArray(r)) rows = r;
    } catch (e) {
      return { error: String(e?.message || e).slice(0, 200) };
    }
  }
  if (!Array.isArray(rows)) return { error: "CF \u672A\u8FD4\u56DE\u6570\u636E" };
  const map = /* @__PURE__ */ new Map();
  let hostMatched = hostFilterUsed;
  for (const item of rows) {
    const h = String(item?.dimensions?.clientRequestHTTPHost || "").toLowerCase();
    if (statsHost && h !== statsHost) continue;
    hostMatched = true;
    const raw = item?.dimensions?.datetimeHour;
    if (!raw) continue;
    const { dateKey } = getShanghaiParts(new Date(raw).getTime());
    const cur = map.get(dateKey) || { requests: 0, traffic: 0, visits: 0 };
    cur.requests += Number(item?.count) || 0;
    cur.traffic += Number(item?.sum?.edgeResponseBytes) || 0;
    cur.visits += Number(item?.sum?.visits) || 0;
    map.set(dateKey, cur);
  }
  if (statsHost && !hostMatched) return { error: "CF \u4E2D\u672A\u627E\u5230 " + statsHost + " \u7684\u6570\u636E", series: [] };
  const series = [];
  for (let i = 0; i < days; i++) {
    const key = new Date((/* @__PURE__ */ new Date(startDate + "T00:00:00Z")).getTime() + i * 864e5).toISOString().slice(0, 10);
    const r = map.get(key) || { requests: 0, traffic: 0, visits: 0 };
    series.push({ date: key, requests: r.requests, traffic: r.traffic, visits: r.visits });
  }
  return { series, zoneId: info3.zoneId, zoneName: info3.zoneName, statsHost, hostMatched };
}
__name(cfGetZoneDailySeries, "cfGetZoneDailySeries");
async function cfGetAccountSummary(env2, dateKey, hostSet = null) {
  const token = getCFApiToken(env2);
  if (!token) return { error: "\u672A\u914D\u7F6E CF_API_TOKEN" };
  let info3;
  try {
    info3 = await resolveZoneInfo(env2);
  } catch (e) {
    return { error: String(e?.message || e) };
  }
  if (!info3.accountId) return { error: "\u672A\u89E3\u6790\u5230 CF_ACCOUNT_ID\uFF08Token \u9700 Account Analytics:Read\uFF09" };
  const { start, end } = dayRangeIso(dateKey);
  let account = null;
  let hostDim = true;
  let firstError = "";
  try {
    account = await cfGetAccountHttp(info3.accountId, token, start, end, true);
  } catch (e) {
    firstError = String(e?.message || e);
    hostDim = false;
    try {
      account = await cfGetAccountHttp(info3.accountId, token, start, end, false);
    } catch (e2) {
      return { error: String(e2?.message || e2).slice(0, 240) };
    }
  }
  if (!account?.series) return { error: "\u8D26\u53F7\u5206\u6790\u672A\u8FD4\u56DE\u6570\u636E\uFF08Token \u9700 Account Analytics:Read \u6743\u9650\uFF09" };
  if (hostDim && account.series.length >= 1e4) {
    try {
      const plain = await cfGetAccountHttp(info3.accountId, token, start, end, false);
      if (Array.isArray(plain?.series)) {
        account = plain;
        hostDim = false;
      }
    } catch (_) {
    }
  }
  const statsHost = getStatsHost(env2);
  const wanted = hostSet && hostSet.size ? makeHostMatcher(env2, hostSet) : null;
  let hostMatched = Boolean(hostDim && wanted);
  let rows = hostDim && wanted ? account.series.filter((it) => wanted(it?.dimensions?.clientRequestHTTPHost)) : account.series;
  if (hostDim && wanted && rows.length === 0) {
    hostMatched = false;
    rows = account.series;
  }
  const sumRows = /* @__PURE__ */ __name((list) => {
    let requests = 0, visits = 0, bytes = 0;
    const hourly = Array.from({ length: 24 }, () => 0);
    const byHost = {};
    for (const item of list) {
      const n = Number(item?.count) || 0;
      const b = Number(item?.sum?.edgeResponseBytes) || 0;
      requests += n;
      visits += Number(item?.sum?.visits) || 0;
      bytes += b;
      const hHost = String(item?.dimensions?.clientRequestHTTPHost || "").toLowerCase();
      if (hHost) {
        const cur = byHost[hHost] || { requests: 0, bytes: 0, visits: 0 };
        cur.requests += n;
        cur.bytes += b;
        cur.visits += Number(item?.sum?.visits) || 0;
        byHost[hHost] = cur;
      }
      const raw = item?.dimensions?.datetimeHour;
      if (raw) {
        const h = (new Date(raw).getUTCHours() + 8) % 24;
        if (h >= 0 && h < 24) hourly[h] += n;
      }
    }
    return { requests, visits, bytes, hourly, byHost };
  }, "sumRows");
  const total = sumRows(rows);
  const mainRows = hostDim && statsHost ? account.series.filter((it) => String(it?.dimensions?.clientRequestHTTPHost || "").toLowerCase().replace(/:\d+$/, "") === statsHost) : rows;
  const main = sumRows(mainRows);
  return {
    requests: total.requests,
    visits: total.visits,
    bytes: total.bytes,
    hourly: total.hourly,
    byHost: total.byHost,
    mainRequests: main.requests,
    mainVisits: main.visits,
    mainBytes: main.bytes,
    accountId: info3.accountId,
    statsHost,
    hostMatched,
    hostDim,
    source: "account",
    note: hostMatched ? "" : "\u8D26\u53F7\u5206\u6790\u4E2D\u672A\u5339\u914D\u5230 Worker \u57DF\u540D\uFF0C\u5F53\u524D\u4F7F\u7528\u8D26\u53F7\u603B\u91CF",
    warning: firstError ? "\u6309\u57DF\u540D\u5206\u7EC4\u67E5\u8BE2\u5931\u8D25\uFF0C\u5DF2\u9000\u56DE\u8D26\u53F7\u6C47\u603B: " + firstError.slice(0, 120) : ""
  };
}
__name(cfGetAccountSummary, "cfGetAccountSummary");
async function cfGetAccountDailySeries(env2, days = 7, hostSet = null) {
  const token = getCFApiToken(env2);
  if (!token) return { error: "\u672A\u914D\u7F6E CF_API_TOKEN" };
  let info3;
  try {
    info3 = await resolveZoneInfo(env2);
  } catch (e) {
    return { error: String(e?.message || e) };
  }
  if (!info3.accountId) return { error: "\u672A\u89E3\u6790\u5230 CF_ACCOUNT_ID" };
  const today = getShanghaiParts().dateKey;
  const startDate = new Date((/* @__PURE__ */ new Date(today + "T00:00:00Z")).getTime() - (days - 1) * 864e5).toISOString().slice(0, 10);
  const start = (/* @__PURE__ */ new Date(startDate + "T00:00:00+08:00")).toISOString();
  const end = new Date((/* @__PURE__ */ new Date(today + "T00:00:00+08:00")).getTime() + 864e5 - 1).toISOString();
  let rows = null;
  let truncated = false;
  try {
    const acc = await cfGetAccountHttp(info3.accountId, token, start, end, true);
    rows = Array.isArray(acc?.series) ? acc.series : null;
    truncated = Boolean(rows && rows.length >= 1e4);
  } catch (_) {
  }
  if (!Array.isArray(rows) || truncated) {
    try {
      const acc = await cfGetAccountHttp(info3.accountId, token, start, end, false);
      rows = Array.isArray(acc?.series) ? acc.series : null;
    } catch (e) {
      return { error: String(e?.message || e).slice(0, 200) };
    }
  }
  if (!Array.isArray(rows)) return { error: "\u8D26\u53F7\u5206\u6790\u672A\u8FD4\u56DE\u6570\u636E" };
  const wanted = hostSet && hostSet.size ? makeHostMatcher(env2, hostSet) : null;
  const map = /* @__PURE__ */ new Map();
  for (const item of rows) {
    const h = String(item?.dimensions?.clientRequestHTTPHost || "").toLowerCase();
    if (wanted && h && !wanted(h)) continue;
    const raw = item?.dimensions?.datetimeHour;
    if (!raw) continue;
    const { dateKey } = getShanghaiParts(new Date(raw).getTime());
    const cur = map.get(dateKey) || { requests: 0, traffic: 0, visits: 0 };
    cur.requests += Number(item?.count) || 0;
    cur.traffic += Number(item?.sum?.edgeResponseBytes) || 0;
    cur.visits += Number(item?.sum?.visits) || 0;
    map.set(dateKey, cur);
  }
  const series = [];
  for (let i = 0; i < days; i++) {
    const key = new Date((/* @__PURE__ */ new Date(startDate + "T00:00:00Z")).getTime() + i * 864e5).toISOString().slice(0, 10);
    const r = map.get(key) || { requests: 0, traffic: 0, visits: 0 };
    series.push({ date: key, requests: r.requests, traffic: r.traffic, visits: r.visits });
  }
  return { series, accountId: info3.accountId, source: "account" };
}
__name(cfGetAccountDailySeries, "cfGetAccountDailySeries");
async function cfGetWorkerSummary(env2, dateKey) {
  const token = getCFApiToken(env2);
  if (!token) return { error: "\u672A\u914D\u7F6E CF_API_TOKEN" };
  let info3;
  try {
    info3 = await resolveZoneInfo(env2);
  } catch (e) {
    return { error: String(e?.message || e) };
  }
  if (!info3.accountId) return { error: "\u672A\u89E3\u6790\u5230 CF_ACCOUNT_ID\uFF08Token \u9700 Account Analytics:Read\uFF09" };
  const { start, end } = dayRangeIso(dateKey);
  try {
    const account = await cfGetWorkerRequests(info3.accountId, token, start, end);
    if (!account?.workersInvocationsAdaptive) return { error: "CF \u672A\u8FD4\u56DE Worker \u8C03\u7528\u6570\u636E" };
    let requests = 0;
    const hourly = Array.from({ length: 24 }, () => 0);
    const byScript = {};
    for (const item of account.workersInvocationsAdaptive) {
      const n = Number(item?.sum?.requests) || 0;
      requests += n;
      const name = item?.dimensions?.scriptName || "unknown";
      byScript[name] = (byScript[name] || 0) + n;
      const raw = item?.dimensions?.datetime;
      if (raw) {
        const h = (new Date(raw).getUTCHours() + 8) % 24;
        if (h >= 0 && h < 24) hourly[h] += n;
      }
    }
    return { requests, hourly, byScript, accountId: info3.accountId };
  } catch (e) {
    return { error: String(e?.message || e).slice(0, 200) };
  }
}
__name(cfGetWorkerSummary, "cfGetWorkerSummary");
function tgEscape(v) {
  return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
__name(tgEscape, "tgEscape");
function describeTelegramError(raw) {
  const msg = String(raw == null ? "" : raw).trim();
  const low = msg.toLowerCase();
  if (!msg) return "\u672A\u77E5\u9519\u8BEF";
  if (low.includes("chat not found")) {
    return msg + "\uFF08\u673A\u5668\u4EBA\u627E\u4E0D\u5230\u8BE5\u4F1A\u8BDD\uFF1A\u8BF7\u5148\u7528 Telegram \u6253\u5F00\u8FD9\u4E2A\u673A\u5668\u4EBA\u5E76\u70B9\u300C\u5F00\u59CB\u300D\u6216\u53D1\u9001 /start\uFF0C\u518D\u786E\u8BA4 TELEGRAM_CHAT_ID \u586B\u7684\u662F\u8BE5\u8D26\u53F7\u7684\u6570\u5B57 ID\uFF0C\u800C\u4E0D\u662F\u624B\u673A\u53F7/\u7528\u6237\u540D\uFF09";
  }
  if (low.includes("bot was blocked")) return msg + "\uFF08\u8BE5\u8D26\u53F7\u628A\u673A\u5668\u4EBA\u62C9\u9ED1/\u5C4F\u853D\u4E86\uFF0C\u8BF7\u5728 Telegram \u4E2D\u89E3\u9664\u5C4F\u853D\u540E\u91CD\u65B0\u53D1\u9001 /start\uFF09";
  if (low.includes("user is deactivated")) return msg + "\uFF08\u8BE5 Telegram \u8D26\u53F7\u5DF2\u6CE8\u9500\uFF09";
  if (low.includes("not enough rights") || low.includes("chat_write_forbidden")) return msg + "\uFF08\u673A\u5668\u4EBA\u4E0D\u5728\u8BE5\u7FA4\u7EC4\uFF0C\u6216\u6CA1\u6709\u53D1\u8A00\u6743\u9650\uFF09";
  if (low.includes("unauthorized") || low.includes("invalid token")) return msg + "\uFF08TELEGRAM_BOT_TOKEN \u65E0\u6548\uFF0C\u8BF7\u5230 BotFather \u91CD\u65B0\u590D\u5236 Token\uFF09";
  if (low.includes("too many requests")) return msg + "\uFF08\u53D1\u9001\u8FC7\u4E8E\u9891\u7E41\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5\uFF09";
  if (low.includes("button_url_invalid") || low.includes("can't parse entities")) return msg + "\uFF08\u6D88\u606F\u5185\u5BB9\u683C\u5F0F\u9519\u8BEF\uFF09";
  return msg;
}
__name(describeTelegramError, "describeTelegramError");
async function sendTelegramMessage(env2, text) {
  const token = getTelegramToken(env2);
  const chatId = getTelegramChatId(env2);
  if (!token || !chatId) {
    return { ok: false, error: "\u672A\u914D\u7F6E TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID\uFF08\u6216 TG_BOT_TOKEN / TG_CHAT_ID\uFF09", rawError: "not configured" };
  }
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 15e3);
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: String(text).slice(0, 4096), parse_mode: "HTML", disable_web_page_preview: true }),
      signal: ctrl.signal
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      const raw = data.description || "HTTP " + res.status;
      return { ok: false, error: describeTelegramError(raw), rawError: raw };
    }
    return { ok: true };
  } catch (e) {
    const raw = String(e?.message || e);
    return { ok: false, error: raw, rawError: raw };
  } finally {
    clearTimeout(tid);
  }
}
__name(sendTelegramMessage, "sendTelegramMessage");
function reportFailureHint(env2, out) {
  const tg = out.telegram || {};
  const wh = out.webhook || {};
  const tgConfigured = Boolean(getTelegramToken(env2) && getTelegramChatId(env2));
  if (tg.error) {
    return tgConfigured ? "Telegram \u53D8\u91CF\u5DF2\u8BFB\u53D6\uFF0C\u4F46\u53D1\u9001\u5931\u8D25\uFF1A" + tg.error : "\u672A\u914D\u7F6E Telegram \u53D8\u91CF\uFF1A\u8BF7\u8BBE\u7F6E TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID\uFF08\u6216 TG_BOT_TOKEN / TG_CHAT_ID\uFF09";
  }
  if (wh.error) return "Webhook \u53D1\u9001\u5931\u8D25\uFF1A" + wh.error;
  if (wh.skipped && !tg.ok) return "\u672A\u914D\u7F6E\u901A\u77E5\u6E20\u9053\uFF1A\u8BF7\u8BBE\u7F6E TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID\uFF08\u6216 TG_*\uFF09\uFF0C\u6216 NOTIFY_WEBHOOK";
  return "\u53D1\u9001\u5931\u8D25\uFF1A\u672A\u77E5\u9519\u8BEF";
}
__name(reportFailureHint, "reportFailureHint");
async function buildDailyReport(env2, dateKey) {
  const key = /^\d{4}-\d{2}-\d{2}$/.test(dateKey || "") ? dateKey : getShanghaiParts().dateKey;
  const workerHosts = await getWorkerHosts(env2);
  const acc = await cfGetAccountSummary(env2, key, workerHosts);
  const accOk = !acc.error;
  const cf = accOk ? { error: "" } : await cfGetZoneSummary(env2, key, workerHosts);
  const cfOk = !accOk && !cf.error;
  const requests = accOk ? Number(acc.requests) || 0 : cfOk ? Number(cf.requests) || 0 : null;
  const traffic = accOk ? Number(acc.bytes) || 0 : cfOk ? Number(cf.bytes) || 0 : null;
  const visits = accOk ? Number(acc.visits) || 0 : cfOk ? Number(cf.visits) || 0 : 0;
  let daily = [];
  if (accOk) {
    const s = await cfGetAccountDailySeries(env2, 7, workerHosts);
    if (!s.error && Array.isArray(s.series)) daily = s.series;
  } else if (cfOk) {
    const zs = await cfGetZoneDailySeries(env2, 7);
    if (!zs.error && Array.isArray(zs.series)) daily = zs.series;
  }
  const lines = [];
  lines.push("\u{1F4CA} <b>Emby Proxy \u65E5\u62A5</b>");
  const host = getStatsHost(env2);
  const dom = getUserDomain(env2) || host || "";
  lines.push("<code>\u6574\u4E2A\u57DF\u540D\uFF08" + tgEscape(dom || "\u5168\u7AD9") + "\uFF09</code>");
  lines.push("<code>" + tgEscape(key) + "</code>");
  lines.push("");
  lines.push("\u8BF7\u6C42\u6570\uFF1A" + (requests == null ? "\uFF08CF \u6570\u636E\u4E0D\u53EF\u7528\uFF09" : "<b>" + requests + "</b>"));
  lines.push("\u51FA\u7AD9\u6D41\u91CF\uFF1A" + (traffic == null ? "\uFF08CF \u6570\u636E\u4E0D\u53EF\u7528\uFF09" : "<b>" + formatBytes(traffic) + "</b>"));
  if (accOk || cfOk) lines.push("CF \u8BBF\u95EE\u91CF\uFF1A<b>" + visits + "</b>");
  if (host) {
    if (accOk && acc.hostDim) {
      lines.push("\u5176\u4E2D " + tgEscape(host) + "\uFF1A" + (Number(acc.mainRequests) || 0) + " \u6B21 / " + formatBytes(Number(acc.mainBytes) || 0));
    } else if (cfOk && cf.hostDim) {
      lines.push("\u5176\u4E2D " + tgEscape(host) + "\uFF1A" + (Number(cf.mainRequests) || 0) + " \u6B21 / " + formatBytes(Number(cf.mainBytes) || 0));
    }
  }
  if (daily.length) {
    lines.push("");
    lines.push("<b>\u8FD1 7 \u65E5\uFF08\u5168\u7AD9\uFF09</b>");
    for (const d of daily) {
      lines.push(d.date + "  " + d.requests + " \u6B21 / " + formatBytes(d.traffic));
    }
  }
  if (!accOk) {
    lines.push("");
    lines.push("<i>\u8D26\u53F7\u5206\u6790\u4E0D\u53EF\u7528\uFF0C\u5DF2\u9000\u56DE " + (cfOk ? "Zone \u7EDF\u8BA1" : "\uFF08\u65E0 CF \u6570\u636E\uFF09") + "\uFF1A" + tgEscape(String(acc.error).slice(0, 160)) + "</i>");
  } else if (acc.hostMatched === false) {
    lines.push("");
    lines.push("<i>\u8D26\u53F7\u5206\u6790\u4E2D\u672A\u5339\u914D\u5230 Worker \u57DF\u540D\uFF0C\u5F53\u524D\u4E3A\u8D26\u53F7\u603B\u91CF</i>");
  }
  lines.push("");
  lines.push("<i>" + tgEscape((/* @__PURE__ */ new Date()).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })) + "</i>");
  const githubUrl = envStr(env2, "GITHUB_URL", "GITHUB_REPO") || "https://github.com/Dirige/EMBY_CF";
  const monitorUrl = envStr(env2, "MONITOR_URL") || "https://yx.255432.xyz/";
  lines.push("");
  lines.push('\u{1F517} GitHub\uFF1A<a href="' + githubUrl + '">' + tgEscape(githubUrl) + "</a>");
  lines.push('\u{1F4C8} \u4F18\u9009\u57DF\u540D\u76D1\u63A7\uFF1A<a href="' + monitorUrl + '">' + tgEscape(monitorUrl) + "</a>");
  return lines.join("\n");
}
__name(buildDailyReport, "buildDailyReport");
async function sendDailyReport(env2, dateKey) {
  const key = /^\d{4}-\d{2}-\d{2}$/.test(dateKey || "") ? dateKey : getShanghaiParts().dateKey;
  const text = await buildDailyReport(env2, key);
  const tg = await sendTelegramMessage(env2, text);
  let webhook = { ok: false, skipped: true };
  if (env2.NOTIFY_WEBHOOK && isValidHttpUrl(env2.NOTIFY_WEBHOOK)) {
    try {
      const res = await fetch(env2.NOTIFY_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, content: text, date: key })
      });
      webhook = { ok: res.ok, status: res.status };
    } catch (e) {
      webhook = { ok: false, error: String(e?.message || e) };
    }
  }
  return { ok: tg.ok || webhook.ok, telegram: tg, webhook, date: key, text };
}
__name(sendDailyReport, "sendDailyReport");
async function claimReportSlot(env2, dateKey) {
  if (!env2.DB) return false;
  try {
    const r = await env2.DB.prepare(
      `INSERT INTO settings (key, value) VALUES ('last_report_date', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value WHERE settings.value <> excluded.value`
    ).bind(dateKey).run();
    return Boolean(r.meta && r.meta.changes);
  } catch (_) {
    return false;
  }
}
__name(claimReportSlot, "claimReportSlot");
var statsBuffer = /* @__PURE__ */ new Map();
var routeStatsBuffer = /* @__PURE__ */ new Map();
var userStatsBuffer = /* @__PURE__ */ new Map();
var statsBufferCount = 0;
var statsLastFlush = Date.now();
function applySecurityHeaders(headers) {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
  return headers;
}
__name(applySecurityHeaders, "applySecurityHeaders");
function sanitizeResponseHeaders(upstreamHeaders) {
  const headers = new Headers();
  for (const [key, value] of upstreamHeaders.entries()) {
    if (!DROP_RESPONSE_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  }
  return headers;
}
__name(sanitizeResponseHeaders, "sanitizeResponseHeaders");
function json(data, status = 200) {
  const headers = { ...CORS_JSON, "Cache-Control": "no-store" };
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers[k] = v;
  return new Response(JSON.stringify(data), { status, headers });
}
__name(json, "json");
function html(body, status = 200) {
  const headers = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" };
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers[k] = v;
  return new Response(body, { status, headers });
}
__name(html, "html");
function getCookie(req, name) {
  const s = req.headers.get("Cookie");
  if (!s) return null;
  const m = s.match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"));
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return null;
  }
}
__name(getCookie, "getCookie");
function getAdminToken(env2) {
  const raw = env2.ADMIN_TOKEN ?? env2.ADMIN_PASSWORD ?? env2.admin_token ?? env2.AdminToken;
  if (raw == null) return null;
  const t = String(raw).trim();
  return t.length ? t : null;
}
__name(getAdminToken, "getAdminToken");
function envStr(env2, ...keys) {
  for (const k of keys) {
    const v = env2 && env2[k];
    if (v !== void 0 && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}
__name(envStr, "envStr");
function getBaseDomain(env2) {
  return envStr(env2, "BASE_DOMAIN", "CF_DOMAIN").toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "").replace(/^\.+|\.+$/g, "");
}
__name(getBaseDomain, "getBaseDomain");
function getUserDomain(env2) {
  const raw = envStr(env2, "USER_DOMAIN", "ENTRY_DOMAIN", "USER_BASE_DOMAIN");
  if (raw) {
    return raw.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "").replace(/^\.+|\.+$/g, "");
  }
  const base = getBaseDomain(env2);
  const dns = getDnsRecordName(env2);
  if (base && dns && base !== dns && base.startsWith(dns + ".")) {
    const rest = base.slice(dns.length + 1);
    if (rest.includes(".")) return rest;
  }
  return base;
}
__name(getUserDomain, "getUserDomain");
function getDnsRecordName(env2) {
  return envStr(env2, "DNS_RECORD_NAME").replace(/^\.+|\.+$/g, "").toLowerCase();
}
__name(getDnsRecordName, "getDnsRecordName");
function toFqdn(name, root) {
  const n = String(name || "").trim().toLowerCase().replace(/^\.+|\.+$/g, "");
  const r = String(root || "").trim().toLowerCase().replace(/^\.+|\.+$/g, "");
  if (!n || n === "@") return r;
  if (!r) return n;
  if (n === r || n.endsWith("." + r)) return n;
  return n + "." + r;
}
__name(toFqdn, "toFqdn");
function getStatsHost(env2) {
  const override = envStr(env2, "STATS_HOSTS").split(/[\s,]+/).filter(Boolean)[0] || "";
  if (override) return override.toLowerCase();
  const base = getBaseDomain(env2);
  const dns = getDnsRecordName(env2);
  if (base && dns && base !== dns && base.startsWith(dns + ".")) return base;
  return toFqdn(dns, base).toLowerCase();
}
__name(getStatsHost, "getStatsHost");
function getCFApiToken(env2) {
  return envStr(env2, "CF_API_TOKEN", "CF_DNS_API_TOKEN", "CF_ANALYTICS_TOKEN");
}
__name(getCFApiToken, "getCFApiToken");
function getTelegramToken(env2) {
  return envStr(env2, "TELEGRAM_BOT_TOKEN", "TG_BOT_TOKEN");
}
__name(getTelegramToken, "getTelegramToken");
function getTelegramChatId(env2) {
  return envStr(env2, "TELEGRAM_CHAT_ID", "TG_CHAT_ID");
}
__name(getTelegramChatId, "getTelegramChatId");
var zoneInfoCaches = /* @__PURE__ */ new Map();
async function findZoneForHost(env2, host) {
  const h = String(host || "").toLowerCase().replace(/^\.+|\.+$/g, "");
  if (!h) return { zone: null, error: "\u57DF\u540D\u4E3A\u7A7A" };
  const exact = await cloudflareAPICall(env2, "GET", "/zones?name=" + encodeURIComponent(h) + "&per_page=1");
  if (exact && exact.success && Array.isArray(exact.result) && exact.result[0]) {
    return { zone: exact.result[0], error: "" };
  }
  const lastError = exact && (exact.errors && exact.errors[0] && exact.errors[0].message || exact.error) || "";
  const list = await cloudflareAPICall(env2, "GET", "/zones?per_page=50");
  if (!list || !list.success || !Array.isArray(list.result)) {
    return { zone: null, error: list && (list.errors && list.errors[0] && list.errors[0].message || list.error) || lastError || "\u8BFB\u53D6\u533A\u57DF\u5217\u8868\u5931\u8D25\uFF08\u68C0\u67E5 Token \u662F\u5426\u6709 Zone:Read \u6743\u9650\uFF09" };
  }
  let best = null;
  for (const z of list.result) {
    const name = String(z && z.name || "").toLowerCase();
    if (!name) continue;
    if (h === name || h.endsWith("." + name)) {
      if (!best || name.length > String(best.name).length) best = z;
    }
  }
  return { zone: best, error: best ? "" : lastError || "\u672A\u627E\u5230\u8BE5\u57DF\u540D\u6240\u5C5E\u533A\u57DF" };
}
__name(findZoneForHost, "findZoneForHost");
async function resolveZoneInfo(env2, force = false, host = "") {
  const envZone = envStr(env2, "CF_ZONE_ID");
  const envAccount = envStr(env2, "CF_ACCOUNT_ID");
  const base = getBaseDomain(env2);
  const target = String(host || getUserDomain(env2) || base || "").toLowerCase().replace(/^\.+|\.+$/g, "").replace(/:\d+$/, "");
  if (envZone && envAccount) return { zoneId: envZone, accountId: envAccount, zoneName: target || base, base: target || base, host: target, error: "", from: "env" };
  const cached = zoneInfoCaches.get(target);
  if (!force && cached && Date.now() - cached.at < 6e5) return cached;
  const token = getCFApiToken(env2);
  if (!target) return { zoneId: envZone, accountId: envAccount, zoneName: "", base, host: "", error: "\u672A\u914D\u7F6E BASE_DOMAIN / USER_DOMAIN", from: "none" };
  if (!token) return { zoneId: envZone, accountId: envAccount, zoneName: target, base: target, host: target, error: "\u672A\u914D\u7F6E CF_API_TOKEN", from: "none" };
  try {
    const { zone, error: error3 } = await findZoneForHost(env2, target);
    const info3 = {
      at: Date.now(),
      base: target,
      host: target,
      zoneId: envZone || zone && zone.id || "",
      accountId: envAccount || zone && zone.account && zone.account.id || "",
      zoneName: zone && zone.name || target,
      error: zone ? "" : error3 || "\u672A\u627E\u5230\u8BE5\u57DF\u540D\u6240\u5C5E\u533A\u57DF",
      from: envZone ? "env+api" : "api"
    };
    zoneInfoCaches.set(target, info3);
    return info3;
  } catch (e) {
    return { zoneId: envZone, accountId: envAccount, zoneName: target, base: target, host: target, error: String(e?.message || e), from: "none" };
  }
}
__name(resolveZoneInfo, "resolveZoneInfo");
function invalidateZoneInfoCache() {
  zoneInfoCaches.clear();
}
__name(invalidateZoneInfoCache, "invalidateZoneInfoCache");
var SESSION_COOKIE = "admin_session";
var SESSION_TTL_SEC = 7 * 24 * 3600;
var ADMIN_UID = 0;
var enc = new TextEncoder();
function toHex(buf) {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(toHex, "toHex");
function hexToBytes(hex) {
  const h = String(hex || "");
  const out = new Uint8Array(Math.floor(h.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16) || 0;
  return out;
}
__name(hexToBytes, "hexToBytes");
async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
}
__name(hmacHex, "hmacHex");
async function safeEqual(a, b, secret) {
  const [x, y] = await Promise.all([hmacHex(secret, "cmp:" + a), hmacHex(secret, "cmp:" + b)]);
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0;
}
__name(safeEqual, "safeEqual");
function sessionSecret(env2) {
  return envStr(env2, "SESSION_SECRET") || getAdminToken(env2) || "";
}
__name(sessionSecret, "sessionSecret");
async function makeSessionToken(secret, uid = ADMIN_UID) {
  const exp = Math.floor(Date.now() / 1e3) + SESSION_TTL_SEC;
  const id = Number(uid) || 0;
  return id + "." + exp + "." + await hmacHex(secret, "session:" + id + ":" + exp);
}
__name(makeSessionToken, "makeSessionToken");
async function verifySessionToken(token, secret) {
  const parts = String(token || "").split(".");
  const now = Math.floor(Date.now() / 1e3);
  if (parts.length === 2) {
    const exp2 = parseInt(parts[0], 10);
    if (!parts[1] || !Number.isFinite(exp2) || exp2 < now) return null;
    if (!await safeEqual(parts[1], await hmacHex(secret, "session:" + exp2), secret)) return null;
    return { uid: ADMIN_UID, exp: exp2 };
  }
  if (parts.length !== 3) return null;
  const uid = parseInt(parts[0], 10);
  const exp = parseInt(parts[1], 10);
  if (!Number.isFinite(uid) || uid < 0 || !Number.isFinite(exp) || exp < now) return null;
  if (!await safeEqual(parts[2], await hmacHex(secret, "session:" + uid + ":" + exp), secret)) return null;
  return { uid, exp };
}
__name(verifySessionToken, "verifySessionToken");
function randomHex(bytes = 16) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return toHex(buf);
}
__name(randomHex, "randomHex");
async function hashPassword(password, saltHex) {
  const key = await crypto.subtle.importKey("raw", enc.encode(String(password || "")), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: hexToBytes(saltHex), iterations: 1e5, hash: "SHA-256" },
    key,
    256
  );
  return toHex(bits);
}
__name(hashPassword, "hashPassword");
async function verifyPassword(password, saltHex, expectedHex) {
  try {
    const got = await hashPassword(password, saltHex);
    return safeEqual(got, expectedHex, "pw-cmp");
  } catch (_) {
    return false;
  }
}
__name(verifyPassword, "verifyPassword");
var userCache = /* @__PURE__ */ new Map();
function clearUserCache() {
  userCache.clear();
  try {
    clearOwnerCache();
  } catch (_) {
  }
}
__name(clearUserCache, "clearUserCache");
function rowToUser(r) {
  if (!r) return null;
  return {
    id: Number(r.id),
    username: r.username,
    passwordHash: r.password_hash,
    salt: r.salt,
    role: r.role || "user",
    status: r.status || "active",
    subdomain: r.subdomain || "",
    routeLimit: Number(r.route_limit) || 20,
    createdAt: r.created_at || "",
    lastLogin: r.last_login || ""
  };
}
__name(rowToUser, "rowToUser");
function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    status: u.status,
    subdomain: u.subdomain || "",
    routeLimit: u.routeLimit || 20,
    createdAt: u.createdAt || "",
    lastLogin: u.lastLogin || ""
  };
}
__name(publicUser, "publicUser");
async function getUserById(env2, id) {
  if (!env2.DB || !Number.isFinite(Number(id))) return null;
  const key = "id:" + id;
  const now = Date.now();
  const hit = userCache.get(key);
  if (hit && hit.exp > now) return hit.user;
  const row = await env2.DB.prepare("SELECT * FROM users WHERE id = ?").bind(Number(id)).first();
  const user = rowToUser(row);
  userCache.set(key, { user, exp: now + 15e3 });
  if (userCache.size > 500) userCache.clear();
  return user;
}
__name(getUserById, "getUserById");
async function getUserByUsername(env2, username) {
  if (!env2.DB || !username) return null;
  const uname = String(username).toLowerCase();
  const key = "name:" + uname;
  const now = Date.now();
  const hit = userCache.get(key);
  if (hit && hit.exp > now) return hit.user;
  const row = await env2.DB.prepare("SELECT * FROM users WHERE username = ?").bind(uname).first();
  const user = rowToUser(row);
  userCache.set(key, { user, exp: now + 15e3 });
  if (userCache.size > 500) userCache.clear();
  return user;
}
__name(getUserByUsername, "getUserByUsername");
async function getSession(request, env2) {
  const secret = sessionSecret(env2);
  if (!secret) return null;
  const tok = getCookie(request, SESSION_COOKIE);
  if (!tok) return null;
  const v = await verifySessionToken(tok, secret);
  if (!v) return null;
  if (v.uid === ADMIN_UID) {
    return { uid: 0, id: 0, username: "admin", role: "admin", status: "active", subdomain: "", isAdmin: true, exp: v.exp };
  }
  const user = await getUserById(env2, v.uid);
  if (!user || user.status !== "active") return null;
  return {
    uid: user.id,
    id: user.id,
    username: user.username,
    role: user.role,
    status: user.status,
    subdomain: user.subdomain,
    isAdmin: user.role === "admin",
    exp: v.exp
  };
}
__name(getSession, "getSession");
async function isAdmin(request, env2) {
  const s = await getSession(request, env2);
  return Boolean(s && s.isAdmin);
}
__name(isAdmin, "isAdmin");
var loginFails = /* @__PURE__ */ new Map();
var LOGIN_MAX_FAILS = 5;
var LOGIN_WINDOW_MS = 10 * 60 * 1e3;
function loginBlocked(ip) {
  const rec = loginFails.get(ip);
  if (!rec) return false;
  if (Date.now() - rec.first > LOGIN_WINDOW_MS) {
    loginFails.delete(ip);
    return false;
  }
  return rec.n >= LOGIN_MAX_FAILS;
}
__name(loginBlocked, "loginBlocked");
function loginFailed(ip) {
  const now = Date.now();
  const rec = loginFails.get(ip);
  if (!rec || now - rec.first > LOGIN_WINDOW_MS) loginFails.set(ip, { n: 1, first: now });
  else rec.n++;
  if (loginFails.size > 5e3) {
    for (const [k, v] of loginFails) if (now - v.first > LOGIN_WINDOW_MS) loginFails.delete(k);
  }
}
__name(loginFailed, "loginFailed");
function sessionCookie(token, maxAge = SESSION_TTL_SEC) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Strict; Secure`;
}
__name(sessionCookie, "sessionCookie");
async function loginJson(env2, uid, username, isAdminUser, extra = {}) {
  const token = await makeSessionToken(sessionSecret(env2), uid);
  return new Response(JSON.stringify({ ok: true, user: { uid, username, isAdmin: Boolean(isAdminUser) }, ...extra }), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Set-Cookie": sessionCookie(token),
      "Cache-Control": "no-store"
    }
  });
}
__name(loginJson, "loginJson");
async function adminLoginResponse(request, env2, creds = {}) {
  const secret = sessionSecret(env2);
  if (!secret) {
    return json({
      ok: false,
      error: "Worker \u672A\u8BFB\u5230 ADMIN_TOKEN / SESSION_SECRET\u3002\u8BF7\u5728 Cloudflare \u63A7\u5236\u53F0 \u2192 Worker \u2192 \u8BBE\u7F6E \u2192 \u53D8\u91CF\u548C\u673A\u5BC6 \u4E2D\u6DFB\u52A0\u3002"
    }, 503);
  }
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (loginBlocked(ip)) return json({ ok: false, error: "\u5C1D\u8BD5\u6B21\u6570\u8FC7\u591A\uFF0C\u8BF7 10 \u5206\u949F\u540E\u518D\u8BD5" }, 429);
  const username = String(creds.username || "").trim().toLowerCase();
  const password = String(creds.password != null ? creds.password : creds.token || "");
  if (!password) return json({ ok: false, error: "\u8BF7\u8F93\u5165\u5BC6\u7801 / \u7BA1\u7406\u5BC6\u94A5" }, 400);
  if (!username || username === "admin") {
    const expected = getAdminToken(env2);
    if (!expected || !await safeEqual(password, expected, secret)) {
      loginFailed(ip);
      return json({ ok: false, error: "\u7BA1\u7406\u5BC6\u94A5\u9519\u8BEF" }, 401);
    }
    loginFails.delete(ip);
    return loginJson(env2, ADMIN_UID, "admin", true);
  }
  const user = await getUserByUsername(env2, username);
  if (!user || user.status !== "active" || !await verifyPassword(password, user.salt, user.passwordHash)) {
    loginFailed(ip);
    return json({ ok: false, error: "\u7528\u6237\u540D\u6216\u5BC6\u7801\u9519\u8BEF" }, 401);
  }
  loginFails.delete(ip);
  try {
    await env2.DB.prepare("UPDATE users SET last_login = ? WHERE id = ?").bind((/* @__PURE__ */ new Date()).toISOString(), user.id).run();
    clearUserCache();
  } catch (_) {
  }
  return loginJson(env2, user.id, user.username, user.role === "admin");
}
__name(adminLoginResponse, "adminLoginResponse");
function makeInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  const rnd = crypto.getRandomValues(new Uint8Array(10));
  for (let i = 0; i < 10; i++) s += alphabet[rnd[i] % alphabet.length];
  return s;
}
__name(makeInviteCode, "makeInviteCode");
async function handleRegister(request, env2) {
  if (!env2.DB) return json({ ok: false, error: "D1 \u6570\u636E\u5E93\u672A\u7ED1\u5B9A" }, 500);
  const secret = sessionSecret(env2);
  if (!secret) return json({ ok: false, error: "\u672A\u914D\u7F6E ADMIN_TOKEN / SESSION_SECRET" }, 503);
  const data = await readJson(request) || {};
  const username = sanitizeUsername(data.username);
  const password = String(data.password || "");
  const code = String(data.invite || data.code || "").trim();
  const requestedSub = username;
  if (!username) return json({ ok: false, error: "\u7528\u6237\u540D\u9700\u4E3A 3-32 \u4F4D\u5C0F\u5199\u5B57\u6BCD\u3001\u6570\u5B57\u6216\u77ED\u6A2A\u7EBF\uFF0C\u4E14\u4E0D\u80FD\u4EE5\u77ED\u6A2A\u7EBF\u5F00\u5934/\u7ED3\u5C3E" }, 400);
  if (password.length < 6) return json({ ok: false, error: "\u5BC6\u7801\u81F3\u5C11 6 \u4F4D" }, 400);
  if (!code) return json({ ok: false, error: "\u8BF7\u8F93\u5165\u9080\u8BF7\u7801" }, 400);
  if (!requestedSub) return json({ ok: false, error: "\u7528\u6237\u540D\u4E0D\u80FD\u4F5C\u4E3A\u5B50\u57DF\u540D\uFF0C\u8BF7\u66F4\u6362" }, 400);
  const entryErr = entryNameError(env2, requestedSub);
  if (entryErr) return json({ ok: false, error: entryErr }, 400);
  const invite = await env2.DB.prepare("SELECT * FROM invite_codes WHERE code = ? OR UPPER(code) = ? LIMIT 1").bind(code, code.toUpperCase()).first();
  if (!invite) return json({ ok: false, error: "\u9080\u8BF7\u7801\u65E0\u6548" }, 403);
  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    return json({ ok: false, error: "\u9080\u8BF7\u7801\u5DF2\u8FC7\u671F" }, 403);
  }
  if (Number(invite.max_uses) > 0 && Number(invite.used_count) >= Number(invite.max_uses)) {
    return json({ ok: false, error: "\u9080\u8BF7\u7801\u4F7F\u7528\u6B21\u6570\u5DF2\u7528\u5B8C" }, 403);
  }
  const exists = await env2.DB.prepare("SELECT 1 AS x FROM users WHERE username = ? OR (subdomain <> '' AND subdomain = ?)").bind(username, requestedSub).first();
  if (exists) return json({ ok: false, error: "\u7528\u6237\u540D\u6216\u5B50\u57DF\u540D\u5DF2\u88AB\u5360\u7528" }, 409);
  const salt = randomHex(16);
  const hash = await hashPassword(password, salt);
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  let batchOut = null;
  try {
    batchOut = await env2.DB.batch([
      env2.DB.prepare("INSERT INTO users (username, password_hash, salt, role, status, subdomain, route_limit, created_at, last_login) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(username, hash, salt, "user", "active", requestedSub, DEFAULT_USER_ROUTE_LIMIT, nowIso, nowIso),
      env2.DB.prepare("UPDATE invite_codes SET used_count = used_count + 1 WHERE code = ? AND (max_uses = 0 OR used_count < max_uses)").bind(invite.code)
    ]);
  } catch (e) {
    return json({ ok: false, error: /UNIQUE/i.test(String(e?.message)) ? "\u7528\u6237\u540D\u6216\u5B50\u57DF\u540D\u5DF2\u88AB\u5360\u7528" : "\u6CE8\u518C\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5" }, 409);
  }
  const usedNow = batchOut && batchOut[1] && batchOut[1].meta ? Number(batchOut[1].meta.changes) : 0;
  if (!usedNow) {
    try {
      await env2.DB.prepare("DELETE FROM users WHERE username = ?").bind(username).run();
    } catch (_) {
    }
    clearUserCache();
    return json({ ok: false, error: "\u9080\u8BF7\u7801\u4F7F\u7528\u6B21\u6570\u5DF2\u7528\u5B8C" }, 403);
  }
  clearUserCache();
  const user = await getUserByUsername(env2, username);
  if (!user) return json({ ok: false, error: "\u6CE8\u518C\u6210\u529F\u4F46\u8BFB\u53D6\u7528\u6237\u5931\u8D25" }, 500);
  await auditLog(env2, "user.register", username + " / " + requestedSub);
  const dns = await provisionUserDns(env2, user);
  return loginJson(
    env2,
    user.id,
    user.username,
    user.role === "admin",
    dns.ok ? { dns: { entryHost: dns.entryHost, target: dns.target, type: dns.type } } : { dnsWarning: dns.error }
  );
}
__name(handleRegister, "handleRegister");
function sanitizeUsername(v) {
  const s = String(v || "").trim().toLowerCase();
  return USERNAME_RE.test(s) ? s : "";
}
__name(sanitizeUsername, "sanitizeUsername");
function sanitizeSubdomain(v) {
  const s = String(v || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!/^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/.test(s)) return "";
  return s;
}
__name(sanitizeSubdomain, "sanitizeSubdomain");
function entryNameError(env2, name) {
  const s = String(name || "").trim().toLowerCase();
  if (!s) return "\u5B50\u57DF\u540D\u4E0D\u5408\u6CD5";
  if (RESERVED_SUBDOMAINS.has(s)) return "\u8BE5\u7528\u6237\u540D\u5DF2\u88AB\u7CFB\u7EDF\u4FDD\u7559\uFF0C\u8BF7\u66F4\u6362";
  const dns = getDnsRecordName(env2);
  if (dns && s === dns) return "\u8BE5\u7528\u6237\u540D\u4E0E Worker \u4E3B\u5165\u53E3\u91CD\u540D\uFF0C\u8BF7\u66F4\u6362";
  if (getStatsHost(env2) && s === getStatsHost(env2)) return "\u8BE5\u7528\u6237\u540D\u4E0E\u7EDF\u8BA1\u5165\u53E3\u91CD\u540D\uFF0C\u8BF7\u66F4\u6362";
  return "";
}
__name(entryNameError, "entryNameError");
async function changePassword(request, env2, session) {
  if (!session || session.uid === ADMIN_UID) return json({ ok: false, error: "\u7BA1\u7406\u5458\u8BF7\u76F4\u63A5\u4FEE\u6539 ADMIN_TOKEN" }, 400);
  const data = await readJson(request) || {};
  const oldPassword = String(data.oldPassword || data.old || "");
  const newPassword = String(data.newPassword || data.new || "");
  if (newPassword.length < 6) return json({ ok: false, error: "\u65B0\u5BC6\u7801\u81F3\u5C11 6 \u4F4D" }, 400);
  const user = await getUserById(env2, session.uid);
  if (!user || !await verifyPassword(oldPassword, user.salt, user.passwordHash)) {
    return json({ ok: false, error: "\u539F\u5BC6\u7801\u9519\u8BEF" }, 401);
  }
  const salt = randomHex(16);
  const hash = await hashPassword(newPassword, salt);
  await env2.DB.prepare("UPDATE users SET password_hash = ?, salt = ? WHERE id = ?").bind(hash, salt, user.id).run();
  clearUserCache();
  await auditLog(env2, "user.password", user.username);
  return json({ ok: true });
}
__name(changePassword, "changePassword");
function logoutResponse() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Set-Cookie": `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict; Secure`,
      "Cache-Control": "no-store"
    }
  });
}
__name(logoutResponse, "logoutResponse");
var SETTING_KEYS = ["health_check", "rate_limit_per_min", "manual_redirect_domains", "domain_proxy_rules", "tg_daily_report", "relay_url", "relay_secret", "relay_enabled"];
var settingsCache = { exp: 0, v: null };
async function getSettings(env2) {
  const now = Date.now();
  if (settingsCache.v && settingsCache.exp > now) return settingsCache.v;
  const raw = {};
  if (env2.DB) {
    try {
      const { results } = await env2.DB.prepare("SELECT key, value FROM settings").all();
      for (const r of results || []) raw[r.key] = r.value;
    } catch (_) {
    }
  }
  let rules = {};
  try {
    rules = JSON.parse(raw.domain_proxy_rules || "{}") || {};
  } catch (_) {
  }
  const v = {
    raw,
    healthCheck: raw.health_check === "1",
    rateLimitPerMin: Math.max(0, parseInt(raw.rate_limit_per_min || "0", 10) || 0),
    manualDomains: String(raw.manual_redirect_domains || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean),
    domainProxyRules: { ...DOMAIN_PROXY_RULES, ...rules },
    // VPS 中继：默认启用（relay_enabled 缺省 = 开）；未配置 url/secret 时自然不生效
    relayUrl: String(raw.relay_url || "").trim(),
    relaySecret: String(raw.relay_secret || "").trim(),
    relayEnabled: String(raw.relay_enabled == null ? "1" : raw.relay_enabled) !== "0"
  };
  settingsCache = { exp: now + 3e4, v };
  return v;
}
__name(getSettings, "getSettings");
async function setSetting(env2, key, value) {
  await env2.DB.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(key, String(value)).run();
  settingsCache = { exp: 0, v: null };
}
__name(setSetting, "setSetting");
async function notify(env2, text) {
  const jobs = [];
  const tgToken = getTelegramToken(env2);
  const tgChat = getTelegramChatId(env2);
  if (tgToken && tgChat) {
    jobs.push(fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: tgChat, text: String(text).slice(0, 4096), parse_mode: "HTML", disable_web_page_preview: true })
    }).catch(() => {
    }));
  }
  if (env2.NOTIFY_WEBHOOK && isValidHttpUrl(env2.NOTIFY_WEBHOOK)) {
    jobs.push(fetch(env2.NOTIFY_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, content: text })
    }).catch(() => {
    }));
  }
  await Promise.all(jobs);
}
__name(notify, "notify");
async function auditLog(env2, action, detail) {
  if (!env2.DB) return;
  try {
    await env2.DB.prepare("INSERT INTO audit_log (ts, action, detail) VALUES (?, ?, ?)").bind((/* @__PURE__ */ new Date()).toISOString(), action, String(detail || "").slice(0, 500)).run();
    if (Math.random() < 0.05) {
      await env2.DB.prepare("DELETE FROM audit_log WHERE id <= (SELECT MAX(id) - 500 FROM audit_log)").run();
    }
  } catch (_) {
  }
}
__name(auditLog, "auditLog");
async function probeTarget(target, timeoutMs = 6e3) {
  const start = Date.now();
  try {
    const res = await fetch(target, {
      method: "GET",
      redirect: "manual",
      headers: { "User-Agent": "proxy-health-check" },
      signal: AbortSignal.timeout(timeoutMs)
    });
    try {
      await res.body?.cancel();
    } catch (_) {
    }
    return { ok: res.status < 500, status: res.status, ms: Date.now() - start };
  } catch (e) {
    return { ok: false, status: 0, ms: -1, error: String(e?.message || e).slice(0, 80) };
  }
}
__name(probeTarget, "probeTarget");
var FORBIDDEN_CUSTOM_HEADERS = /* @__PURE__ */ new Set(["host", "content-length", "connection", "transfer-encoding", "upgrade", "te", "keep-alive", "proxy-authorization"]);
function parseHeaderLines(text) {
  const out = [];
  let error3 = null;
  for (const line of String(text || "").split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const i = t.indexOf(":");
    if (i <= 0) {
      error3 = "\u81EA\u5B9A\u4E49\u8BF7\u6C42\u5934\u683C\u5F0F\u5E94\u4E3A Name: Value\uFF0C\u6BCF\u884C\u4E00\u4E2A";
      break;
    }
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim();
    if (!/^[A-Za-z0-9-]+$/.test(k)) {
      error3 = "\u8BF7\u6C42\u5934\u540D\u79F0\u4E0D\u5408\u6CD5: " + k;
      break;
    }
    if (FORBIDDEN_CUSTOM_HEADERS.has(k.toLowerCase())) {
      error3 = "\u4E0D\u5141\u8BB8\u8986\u76D6\u8BF7\u6C42\u5934: " + k;
      break;
    }
    out.push([k, v]);
  }
  return { headers: out, error: error3 };
}
__name(parseHeaderLines, "parseHeaderLines");
function parseIpList(text) {
  return String(text || "").split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);
}
__name(parseIpList, "parseIpList");
function ipv4ToInt(ip) {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return (p[0] << 24 >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
}
__name(ipv4ToInt, "ipv4ToInt");
function ipMatches(ip, list) {
  for (const item of list) {
    if (item === ip) return true;
    const m = item.match(/^(\d+\.\d+\.\d+\.\d+)\/(\d{1,2})$/);
    if (m && !ip.includes(":")) {
      const base = ipv4ToInt(m[1]);
      const cur = ipv4ToInt(ip);
      const bits = parseInt(m[2], 10);
      if (base == null || cur == null || bits > 32) continue;
      const mask = bits === 0 ? 0 : 4294967295 << 32 - bits >>> 0;
      if ((base & mask) >>> 0 === (cur & mask) >>> 0) return true;
    }
  }
  return false;
}
__name(ipMatches, "ipMatches");
function validIpList(list) {
  return list.every((x) => /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(x) || /^[0-9a-fA-F:]+$/.test(x));
}
__name(validIpList, "validIpList");
var rateMap = /* @__PURE__ */ new Map();
function rateLimited(ip, limit) {
  if (!limit) return false;
  const now = Date.now();
  const rec = rateMap.get(ip);
  if (!rec || now - rec.start > 6e4) {
    rateMap.set(ip, { start: now, n: 1 });
  } else {
    rec.n++;
    if (rec.n > limit) return true;
  }
  if (rateMap.size > 2e4) {
    for (const [k, v] of rateMap) if (now - v.start > 6e4) rateMap.delete(k);
  }
  return false;
}
__name(rateLimited, "rateLimited");
async function cachedJson(request, key, ttlSec, producer) {
  const cache = caches.default;
  const ck = new Request("https://cache.internal/" + key);
  try {
    const hit = await cache.match(ck);
    if (hit) return new Response(hit.body, hit);
  } catch (_) {
  }
  const res = await producer();
  try {
    const copy = new Response(res.clone().body, res);
    copy.headers.set("Cache-Control", "public, max-age=" + ttlSec);
    await cache.put(ck, copy);
  } catch (_) {
  }
  return res;
}
__name(cachedJson, "cachedJson");
function isPrivateHost(h) {
  h = String(h || "").toLowerCase().replace(/^\[|\]$/g, "");
  if (!h || h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(h)) {
    const [a, b] = h.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a >= 224;
  }
  if (h.includes(":")) return h === "::1" || h === "::" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80");
  return false;
}
__name(isPrivateHost, "isPrivateHost");
function directProxyAllowed(env2, hostname) {
  if (String(env2.DISABLE_DIRECT_PROXY || "") === "1") return false;
  if (isPrivateHost(hostname)) return false;
  const list = String(env2.DIRECT_PROXY_ALLOW || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (!list.length) return true;
  const h = hostname.toLowerCase();
  return list.some((d) => h === d || h.endsWith("." + d));
}
__name(directProxyAllowed, "directProxyAllowed");
function isValidHttpUrl(u) {
  try {
    const x = new URL(u);
    return x.protocol === "http:" || x.protocol === "https:";
  } catch {
    return false;
  }
}
__name(isValidHttpUrl, "isValidHttpUrl");
function getClientCacheKey(request) {
  const ip = request.headers.get("cf-connecting-ip") || "0.0.0.0";
  const cf = request.cf || {};
  let ipKey = ip;
  if (ip.includes(".")) ipKey = ip.split(".").slice(0, 3).join(".");
  else if (ip.includes(":")) ipKey = ip.split(":").slice(0, 4).join(":");
  return `${cf.country || "XX"}|${cf.city || ""}|${cf.asn || ""}|${ipKey}`;
}
__name(getClientCacheKey, "getClientCacheKey");
var dbInitPromise = null;
async function initDatabase(env2) {
  if (!env2.DB || dbReady) return;
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      await initDatabaseSchema(env2);
      dbReady = true;
    })();
  }
  try {
    await dbInitPromise;
  } catch (_) {
    dbInitPromise = null;
    dbReady = false;
  }
}
__name(initDatabase, "initDatabase");
var SCHEMA_ID = "multi-v6.8.3";
async function initDatabaseSchema(env2) {
  try {
    const marker = await env2.DB.prepare(`SELECT value FROM settings WHERE key = 'schema_init'`).first();
    if (marker && marker.value === SCHEMA_ID) return;
  } catch (_) {
  }
  await env2.DB.batch([
    env2.DB.prepare(`CREATE TABLE IF NOT EXISTS routes (
      prefix TEXT PRIMARY KEY, target TEXT NOT NULL,
      remark TEXT DEFAULT '', last_play TEXT DEFAULT '',
      cache_img TEXT DEFAULT 'on', compat_mode TEXT DEFAULT 'off',
      ip_mode TEXT DEFAULT 'forward',
      sort_order INTEGER DEFAULT 0,
      created_by TEXT NOT NULL DEFAULT ''
    )`),
    env2.DB.prepare(`CREATE TABLE IF NOT EXISTS optimized_domains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      is_builtin INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`),
    env2.DB.prepare(`CREATE TABLE IF NOT EXISTS dns_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dns_name TEXT NOT NULL,
      current_domain TEXT,
      zone_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`),
    // 新增：小时级聚合统计（参考 CF-EMBY-PROXY-UI proxy_stats_hourly）
    env2.DB.prepare(`CREATE TABLE IF NOT EXISTS proxy_stats_hourly (
      bucket_date TEXT NOT NULL,
      bucket_hour INTEGER NOT NULL,
      request_count INTEGER NOT NULL DEFAULT 0,
      play_count INTEGER NOT NULL DEFAULT 0,
      playback_info_count INTEGER NOT NULL DEFAULT 0,
      traffic_bytes INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (bucket_date, bucket_hour)
    )`),
    env2.DB.prepare(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '')`),
    env2.DB.prepare(`CREATE TABLE IF NOT EXISTS route_health (
      prefix TEXT NOT NULL, target TEXT NOT NULL,
      down INTEGER NOT NULL DEFAULT 0, fail_count INTEGER NOT NULL DEFAULT 0,
      latency INTEGER NOT NULL DEFAULT -1, last_check TEXT, last_change TEXT,
      PRIMARY KEY (prefix, target)
    )`),
    env2.DB.prepare(`CREATE TABLE IF NOT EXISTS route_stats_daily (
      prefix TEXT NOT NULL, bucket_date TEXT NOT NULL,
      request_count INTEGER NOT NULL DEFAULT 0, traffic_bytes INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (prefix, bucket_date)
    )`),
    env2.DB.prepare(`CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL DEFAULT ''
    )`),
    // ===== 多人版 =====
    env2.DB.prepare(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'active',
      subdomain TEXT NOT NULL DEFAULT '',
      route_limit INTEGER NOT NULL DEFAULT 20,
      created_at TEXT NOT NULL DEFAULT '',
      last_login TEXT NOT NULL DEFAULT ''
    )`),
    env2.DB.prepare(`CREATE TABLE IF NOT EXISTS invite_codes (
      code TEXT PRIMARY KEY,
      max_uses INTEGER NOT NULL DEFAULT 1,
      used_count INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT ''
    )`),
    env2.DB.prepare(`CREATE TABLE IF NOT EXISTS user_routes (
      owner TEXT NOT NULL,
      prefix TEXT NOT NULL,
      target TEXT NOT NULL,
      remark TEXT DEFAULT '',
      last_play TEXT DEFAULT '',
      cache_img TEXT DEFAULT 'on',
      compat_mode TEXT DEFAULT 'off',
      ip_mode TEXT DEFAULT 'forward',
      sort_order INTEGER DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      custom_headers TEXT NOT NULL DEFAULT '',
      ip_allow TEXT NOT NULL DEFAULT '',
      ip_block TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (owner, prefix)
    )`),
    env2.DB.prepare(`CREATE TABLE IF NOT EXISTS user_stats_hourly (
      owner TEXT NOT NULL,
      bucket_date TEXT NOT NULL,
      bucket_hour INTEGER NOT NULL,
      request_count INTEGER NOT NULL DEFAULT 0,
      play_count INTEGER NOT NULL DEFAULT 0,
      playback_info_count INTEGER NOT NULL DEFAULT 0,
      traffic_bytes INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (owner, bucket_date, bucket_hour)
    )`)
  ]);
  try {
    await env2.DB.prepare(`ALTER TABLE routes ADD COLUMN ip_mode TEXT DEFAULT 'forward'`).run();
  } catch (e) {
  }
  try {
    await env2.DB.prepare(`ALTER TABLE users ADD COLUMN subdomain TEXT NOT NULL DEFAULT ''`).run();
  } catch (e) {
  }
  try {
    await env2.DB.prepare(`ALTER TABLE users ADD COLUMN route_limit INTEGER NOT NULL DEFAULT 20`).run();
  } catch (e) {
  }
  try {
    await env2.DB.prepare(`ALTER TABLE users ADD COLUMN last_login TEXT NOT NULL DEFAULT ''`).run();
  } catch (e) {
  }
  try {
    await env2.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_subdomain ON users(subdomain) WHERE subdomain <> ''`).run();
  } catch (e) {
  }
  for (const col of [
    `max_uses INTEGER NOT NULL DEFAULT 1`,
    `used_count INTEGER NOT NULL DEFAULT 0`,
    `expires_at TEXT NOT NULL DEFAULT ''`,
    `note TEXT NOT NULL DEFAULT ''`,
    `created_by TEXT NOT NULL DEFAULT ''`,
    `created_at TEXT NOT NULL DEFAULT ''`
  ]) {
    try {
      await env2.DB.prepare(`ALTER TABLE invite_codes ADD COLUMN ${col}`).run();
    } catch (e) {
    }
  }
  try {
    await env2.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_user_routes_owner ON user_routes(owner)`).run();
  } catch (e) {
  }
  try {
    await env2.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_user_stats_owner ON user_stats_hourly(owner, bucket_date)`).run();
  } catch (e) {
  }
  for (const col of [
    `enabled INTEGER NOT NULL DEFAULT 1`,
    `custom_headers TEXT NOT NULL DEFAULT ''`,
    `ip_allow TEXT NOT NULL DEFAULT ''`,
    `ip_block TEXT NOT NULL DEFAULT ''`,
    // 路由归属：记录是哪个管理员添加的。老数据为空字符串，视为「历史路由」，
    // 仍在代理链路里生效，但不会出现在任何管理员的「我的路由」里。
    `created_by TEXT NOT NULL DEFAULT ''`
  ]) {
    try {
      await env2.DB.prepare(`ALTER TABLE routes ADD COLUMN ${col}`).run();
    } catch (e) {
    }
  }
  try {
    await env2.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_routes_created_by ON routes(created_by)`).run();
  } catch (e) {
  }
  try {
    let hasUserId = false;
    try {
      await env2.DB.prepare("SELECT user_id FROM routes LIMIT 1").first();
      hasUserId = true;
    } catch (_) {
    }
    if (hasUserId) {
      const done = await env2.DB.prepare("SELECT value FROM settings WHERE key = 'route_owner_from_user_id_v1'").first();
      if (!done) {
        await env2.DB.prepare(
          `UPDATE routes
              SET created_by = COALESCE((SELECT username FROM users WHERE users.id = routes.user_id), '')
            WHERE user_id IS NOT NULL AND user_id <> '' AND CAST(user_id AS INTEGER) > 0`
        ).run();
        await env2.DB.prepare("INSERT INTO settings (key, value) VALUES ('route_owner_from_user_id_v1', '1') ON CONFLICT(key) DO UPDATE SET value = '1'").run();
      }
    }
  } catch (e) {
  }
  try {
    await env2.DB.prepare(`DELETE FROM optimized_domains WHERE domain = 'www.visa.cn' AND is_builtin = 1`).run();
  } catch (e) {
  }
  try {
    await env2.DB.prepare(`ALTER TABLE proxy_stats_hourly ADD COLUMN traffic_bytes INTEGER NOT NULL DEFAULT 0`).run();
  } catch (e) {
  }
  try {
    await env2.DB.prepare(`ALTER TABLE proxy_stats_hourly ADD COLUMN play_count INTEGER NOT NULL DEFAULT 0`).run();
  } catch (e) {
  }
  try {
    await env2.DB.prepare(`ALTER TABLE proxy_stats_hourly ADD COLUMN playback_info_count INTEGER NOT NULL DEFAULT 0`).run();
  } catch (e) {
  }
  try {
    const { results } = await env2.DB.prepare("SELECT COUNT(*) as count FROM optimized_domains").all();
    if (results[0].count === 0) {
      const stmt = env2.DB.prepare("INSERT INTO optimized_domains (domain, name, is_builtin) VALUES (?, ?, 1)");
      for (const d of DEFAULT_OPTIMIZED_DOMAINS) {
        try {
          await stmt.bind(d.domain, d.name).run();
        } catch (e) {
        }
      }
    }
  } catch (e) {
  }
  try {
    await env2.DB.prepare(
      `INSERT INTO settings (key, value) VALUES ('schema_init', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).bind(SCHEMA_ID).run();
  } catch (_) {
  }
}
__name(initDatabaseSchema, "initDatabaseSchema");
async function getOptimizedDomains(env2) {
  const { results } = await env2.DB.prepare("SELECT * FROM optimized_domains ORDER BY is_builtin DESC, name ASC").all();
  return results.map((r) => ({
    id: r.id,
    domain: r.domain,
    name: r.name,
    isBuiltin: Boolean(r.is_builtin),
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }));
}
__name(getOptimizedDomains, "getOptimizedDomains");
async function addOptimizedDomain(env2, domain2, name) {
  const result = await env2.DB.prepare("INSERT INTO optimized_domains (domain, name, is_builtin) VALUES (?, ?, 0)").bind(domain2, name).run();
  return result.success;
}
__name(addOptimizedDomain, "addOptimizedDomain");
function normalizeDomain(v) {
  const d = String(v || "").trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
  return /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(d) ? d : "";
}
__name(normalizeDomain, "normalizeDomain");
async function updateOptimizedDomain(env2, id, domain2, name) {
  const result = await env2.DB.prepare("UPDATE optimized_domains SET domain = ?, name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND is_builtin = 0").bind(domain2, name, id).run();
  return Boolean(result.meta && result.meta.changes);
}
__name(updateOptimizedDomain, "updateOptimizedDomain");
async function deleteOptimizedDomain(env2, id) {
  const result = await env2.DB.prepare("DELETE FROM optimized_domains WHERE id = ? AND is_builtin = 0").bind(id).run();
  return Boolean(result.meta && result.meta.changes);
}
__name(deleteOptimizedDomain, "deleteOptimizedDomain");
async function getDNSConfig(env2) {
  const { results } = await env2.DB.prepare("SELECT * FROM dns_config ORDER BY id DESC LIMIT 1").all();
  if (results.length > 0) {
    return {
      id: results[0].id,
      dnsName: results[0].dns_name,
      currentDomain: results[0].current_domain,
      zoneId: results[0].zone_id,
      createdAt: results[0].created_at,
      updatedAt: results[0].updated_at
    };
  }
  return null;
}
__name(getDNSConfig, "getDNSConfig");
async function saveDNSConfig(env2, dnsName, currentDomain, zoneId) {
  const existing = await getDNSConfig(env2);
  let result;
  if (existing) {
    result = await env2.DB.prepare("UPDATE dns_config SET dns_name = ?, current_domain = ?, zone_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(dnsName, currentDomain || "", zoneId || "", existing.id).run();
  } else {
    result = await env2.DB.prepare("INSERT INTO dns_config (dns_name, current_domain, zone_id) VALUES (?, ?, ?)").bind(dnsName, currentDomain || "", zoneId || "").run();
  }
  return result.success;
}
__name(saveDNSConfig, "saveDNSConfig");
async function cloudflareAPICall(env2, method, endpoint, body = null) {
  const apiToken = getCFApiToken(env2);
  const zoneId = env2.CF_ZONE_ID;
  const accountId = env2.CF_ACCOUNT_ID;
  const dnsRecordName = env2.DNS_RECORD_NAME;
  if (!apiToken) {
    return { success: false, error: "CF_API_TOKEN not configured" };
  }
  const url = `https://api.cloudflare.com/client/v4${endpoint}`;
  const headers = {
    "Authorization": "Bearer " + apiToken,
    "Content-Type": "application/json"
  };
  const options = {
    method,
    headers
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    return data;
  } catch (error3) {
    return { success: false, error: error3.message };
  }
}
__name(cloudflareAPICall, "cloudflareAPICall");
async function getZones(env2) {
  const accountId = env2.CF_ACCOUNT_ID;
  const endpoint = accountId ? "/zones?per_page=50&account.id=" + accountId : "/zones?per_page=50";
  return await cloudflareAPICall(env2, "GET", endpoint);
}
__name(getZones, "getZones");
async function getDNSRecords(env2, zoneId) {
  return await cloudflareAPICall(env2, "GET", `/zones/${zoneId}/dns_records?per_page=100`);
}
__name(getDNSRecords, "getDNSRecords");
function detectRecordType(content) {
  const v = String(content || "").trim();
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(v)) return "A";
  if (v.includes(":") && /^[0-9a-fA-F:]+$/.test(v)) return "AAAA";
  return "CNAME";
}
__name(detectRecordType, "detectRecordType");
async function createOrUpdateDNSRecord(env2, zoneId, dnsName, targetDomain, rootDomain, opts = {}) {
  if (!zoneId) zoneId = env2.CF_ZONE_ID;
  const baseDomain = rootDomain || getBaseDomain(env2) || "";
  const rawName = String(dnsName || "").trim().replace(/^\.+|\.+$/g, "");
  const recordHost = rawName === "@" ? baseDomain : rawName;
  const fullDNSName = recordHost === baseDomain ? baseDomain : baseDomain && !recordHost.endsWith("." + baseDomain) ? `${recordHost}.${baseDomain}` : recordHost;
  const recordsResult = await getDNSRecords(env2, zoneId);
  if (!recordsResult.success) {
    return recordsResult;
  }
  const recordType = detectRecordType(targetDomain);
  const proxied = opts.proxied === true;
  const recordData = {
    type: recordType,
    name: fullDNSName,
    content: targetDomain,
    ttl: 1,
    proxied: recordType === "CNAME" || recordType === "A" || recordType === "AAAA" ? proxied : false
  };
  const sameType = recordsResult.result.filter((r) => r.name === fullDNSName && ["A", "AAAA", "CNAME"].includes(r.type));
  if (!opts.forceRecreate && sameType.length === 1 && sameType[0].type === recordType) {
    const upd = await cloudflareAPICall(env2, "PUT", `/zones/${zoneId}/dns_records/${sameType[0].id}`, recordData);
    if (upd.success) {
      if (opts.saveConfig !== false) await saveDNSConfig(env2, dnsName, targetDomain, zoneId);
      return upd;
    }
  }
  const oldRecords = recordsResult.result.filter((r) => r.name === fullDNSName && ["A", "AAAA", "CNAME"].includes(r.type));
  for (const old of oldRecords) {
    const delResult = await cloudflareAPICall(env2, "DELETE", `/zones/${zoneId}/dns_records/${old.id}`);
    if (!delResult.success) {
      return { success: false, error: "\u5220\u9664\u65E7\u8BB0\u5F55\u5931\u8D25: " + (delResult.errors?.[0]?.message || "\u672A\u77E5\u9519\u8BEF") };
    }
  }
  let result = await cloudflareAPICall(env2, "POST", `/zones/${zoneId}/dns_records`, recordData);
  if (!result.success) {
    const rollbackFailed = [];
    for (const old of oldRecords) {
      const rb = await cloudflareAPICall(env2, "POST", `/zones/${zoneId}/dns_records`, {
        type: old.type,
        name: old.name,
        content: old.content,
        ttl: old.ttl || 1,
        proxied: Boolean(old.proxied)
      });
      if (!rb.success) rollbackFailed.push(old.name + " (" + old.type + ")");
    }
    let errMsg = result.errors?.[0]?.message || "\u521B\u5EFA\u65B0\u8BB0\u5F55\u5931\u8D25";
    if (rollbackFailed.length) {
      errMsg += "\uFF1B\u56DE\u6EDA\u5931\u8D25\uFF0C\u4EE5\u4E0B\u539F\u8BB0\u5F55\u672A\u80FD\u6062\u590D\uFF0C\u8BF7\u624B\u52A8\u5904\u7406: " + rollbackFailed.join(", ");
    } else if (oldRecords.length) {
      errMsg += "\uFF08\u539F\u8BB0\u5F55\u5DF2\u81EA\u52A8\u6062\u590D\uFF09";
    }
    return { success: false, error: errMsg, errors: result.errors };
  }
  if (opts.saveConfig !== false) await saveDNSConfig(env2, dnsName, targetDomain, zoneId);
  return result;
}
__name(createOrUpdateDNSRecord, "createOrUpdateDNSRecord");
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
function escapeLike(s) {
  return String(s || "").replace(/[!%_]/g, (ch) => "!" + ch);
}
__name(escapeLike, "escapeLike");
async function getD1Stats(env2, dateKey, owner = "") {
  const empty = { requests: 0, plays: 0, playbackInfo: 0, traffic: 0, hourly: new Array(24).fill(0), routes: [] };
  if (!env2.DB) return empty;
  try {
    if (owner) {
      const totals2 = await env2.DB.prepare(
        `SELECT COALESCE(SUM(request_count),0) AS requests,
                COALESCE(SUM(play_count),0) AS plays,
                COALESCE(SUM(playback_info_count),0) AS info,
                COALESCE(SUM(traffic_bytes),0) AS traffic
         FROM user_stats_hourly WHERE owner = ? AND bucket_date = ?`
      ).bind(owner, dateKey).first();
      const hourly2 = await env2.DB.prepare(
        `SELECT bucket_hour AS hour,
                COALESCE(SUM(request_count),0) AS requests,
                COALESCE(SUM(traffic_bytes),0) AS traffic
         FROM user_stats_hourly WHERE owner = ? AND bucket_date = ? GROUP BY bucket_hour`
      ).bind(owner, dateKey).all();
      const routes2 = await env2.DB.prepare(
        `SELECT prefix,
                COALESCE(SUM(request_count),0) AS requests,
                COALESCE(SUM(traffic_bytes),0) AS traffic
         FROM route_stats_daily WHERE bucket_date = ? AND prefix LIKE ? ESCAPE '!' GROUP BY prefix ORDER BY requests DESC LIMIT 12`
      ).bind(dateKey, escapeLike(owner) + "/%").all();
      const h2 = new Array(24).fill(0);
      for (const r of hourly2.results || []) {
        const i = Number(r.hour);
        if (i >= 0 && i < 24) h2[i] += Number(r.requests) || 0;
      }
      return {
        requests: Number(totals2?.requests) || 0,
        plays: Number(totals2?.plays) || 0,
        playbackInfo: Number(totals2?.info) || 0,
        traffic: Number(totals2?.traffic) || 0,
        hourly: h2,
        routes: (routes2.results || []).map((r) => ({
          prefix: String(r.prefix || "").startsWith(owner + "/") ? String(r.prefix).slice(owner.length + 1) : r.prefix || "",
          requests: Number(r.requests) || 0,
          traffic: Number(r.traffic) || 0
        }))
      };
    }
    const totals = await env2.DB.prepare(
      `SELECT COALESCE(SUM(request_count),0) AS requests,
              COALESCE(SUM(play_count),0) AS plays,
              COALESCE(SUM(playback_info_count),0) AS info,
              COALESCE(SUM(traffic_bytes),0) AS traffic
       FROM proxy_stats_hourly WHERE bucket_date = ?`
    ).bind(dateKey).first();
    const hourly = await env2.DB.prepare(
      `SELECT bucket_hour AS hour,
              COALESCE(SUM(request_count),0) AS requests,
              COALESCE(SUM(traffic_bytes),0) AS traffic
       FROM proxy_stats_hourly WHERE bucket_date = ? GROUP BY bucket_hour`
    ).bind(dateKey).all();
    const routes = await env2.DB.prepare(
      `SELECT prefix,
              COALESCE(SUM(request_count),0) AS requests,
              COALESCE(SUM(traffic_bytes),0) AS traffic
       FROM route_stats_daily WHERE bucket_date = ? AND instr(prefix, '/') = 0
       GROUP BY prefix ORDER BY requests DESC LIMIT 12`
    ).bind(dateKey).all();
    const h = new Array(24).fill(0);
    for (const r of hourly.results || []) {
      const i = Number(r.hour);
      if (i >= 0 && i < 24) h[i] += Number(r.requests) || 0;
    }
    return {
      requests: Number(totals?.requests) || 0,
      plays: Number(totals?.plays) || 0,
      playbackInfo: Number(totals?.info) || 0,
      traffic: Number(totals?.traffic) || 0,
      hourly: h,
      routes: (routes.results || []).map((r) => ({ prefix: r.prefix || "", requests: Number(r.requests) || 0, traffic: Number(r.traffic) || 0 }))
    };
  } catch (e) {
    console.error("getD1Stats failed:", e?.message);
    return empty;
  }
}
__name(getD1Stats, "getD1Stats");
async function handleStatsRequest(env2, url, opts = {}) {
  if (!env2.DB) return json({ error: "D1 \u6570\u636E\u5E93\u672A\u7ED1\u5B9A", data: null });
  const owner = String(opts.owner || "").toLowerCase();
  const dateParam = url.searchParams.get("date") || "";
  const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : getShanghaiParts().dateKey;
  const d1 = await getD1Stats(env2, dateKey, owner);
  let hostSet = null;
  if (owner) {
    const userDomain = getUserDomain(env2);
    let sub = "";
    try {
      const row = await env2.DB.prepare("SELECT subdomain, username FROM users WHERE username = ?").bind(owner).first();
      sub = String(row?.subdomain || row?.username || owner).trim().toLowerCase();
    } catch (_) {
      sub = owner;
    }
    if (userDomain && sub) hostSet = /* @__PURE__ */ new Set([sub + "." + userDomain]);
  } else {
    hostSet = await getWorkerHosts(env2);
  }
  const acc = hostSet ? await cfGetAccountSummary(env2, dateKey, hostSet) : { error: "\u672A\u914D\u7F6E\u7EDF\u8BA1\u57DF\u540D\u8303\u56F4" };
  const accOk = !acc.error;
  const cf = accOk || owner ? { error: "" } : await cfGetZoneSummary(env2, dateKey);
  const worker = owner ? { error: "" } : await cfGetWorkerSummary(env2, dateKey);
  const cfOk = !accOk && !owner && !cf.error;
  const statsSource = accOk ? "account" : cfOk ? "zone" : "unavailable";
  const trafficBytes = accOk ? Number(acc.bytes) || 0 : cfOk ? Number(cf.bytes) || 0 : null;
  const requests = accOk ? Number(acc.requests) || 0 : cfOk ? Number(cf.requests) || 0 : null;
  const visits = accOk ? Number(acc.visits) || 0 : cfOk ? Number(cf.visits) || 0 : null;
  const hourly = accOk ? acc.hourly : cfOk ? cf.hourly : null;
  const hourlySeries = Array.from({ length: 24 }, (_, h) => ({
    label: String(h).padStart(2, "0") + ":00",
    total: hourly ? hourly[h] || 0 : 0,
    cf: hourly ? hourly[h] || 0 : 0
  }));
  let dailySeries = [];
  if (accOk) {
    const s = await cfGetAccountDailySeries(env2, 7, hostSet);
    if (!s.error && Array.isArray(s.series)) dailySeries = s.series;
  }
  const zoneInfo = owner ? { zoneId: "", zoneName: "", from: "" } : await resolveZoneInfo(env2);
  const tgReady = Boolean(getTelegramToken(env2) && getTelegramChatId(env2));
  return json({
    error: null,
    data: {
      date: dateKey,
      scope: owner ? "user" : "global",
      owner,
      todayRequests: requests,
      todayTraffic: trafficBytes == null ? null : formatBytes(trafficBytes),
      todayTrafficBytes: trafficBytes,
      todayVisits: visits,
      plays: d1.plays,
      playbackInfo: d1.playbackInfo,
      d1: { requests: d1.requests, trafficBytes: d1.traffic, plays: d1.plays, playbackInfo: d1.playbackInfo },
      account: accOk ? { requests: Number(acc.requests) || 0, trafficBytes: Number(acc.bytes) || 0, visits: Number(acc.visits) || 0, accountId: acc.accountId, hostMatched: acc.hostMatched, note: acc.note || "", warning: acc.warning || "" } : { error: acc.error || "" },
      cf: cfOk ? { requests: Number(cf.requests) || 0, trafficBytes: Number(cf.bytes) || 0, visits: Number(cf.visits) || 0, zoneId: cf.zoneId, zoneName: cf.zoneName, hostMatched: cf.hostMatched, note: cf.note || "", warning: cf.warning || "" } : { error: cf.error },
      worker: worker.error ? { error: worker.error } : { requests: Number(worker.requests) || 0, byScript: worker.byScript || {} },
      hourlySeries,
      dailySeries,
      topRoutes: d1.routes,
      statsSource,
      cfStatus: owner ? accOk ? "CF \u8D26\u53F7\u5206\u6790\uFF08\u6211\u7684\u57DF\u540D\uFF09" : "CF \u6570\u636E\u4E0D\u53EF\u7528" : accOk ? acc.hostMatched === false ? "CF \u8D26\u53F7\u5206\u6790\uFF08\u8D26\u53F7\u603B\u91CF\uFF09" : "CF \u8D26\u53F7\u5206\u6790\uFF08\u6574\u4E2A\u57DF\u540D\uFF09" : cfOk ? "CF Zone \u7EDF\u8BA1" : "CF \u6570\u636E\u4E0D\u53EF\u7528",
      cfError: owner ? accOk ? "" : acc.error || "" : accOk || cfOk ? "" : acc.error || cf.error,
      envInfo: {
        baseDomain: getBaseDomain(env2),
        statsHost: getStatsHost(env2),
        zoneId: zoneInfo.zoneId || "",
        zoneSource: zoneInfo.from || "",
        hasCfToken: Boolean(getCFApiToken(env2)),
        telegramConfigured: tgReady,
        telegramTokenVar: getTelegramToken(env2) ? "\u5DF2\u8BFB\u53D6" : "\u672A\u8BFB\u53D6",
        telegramChatVar: getTelegramChatId(env2) ? "\u5DF2\u8BFB\u53D6" : "\u672A\u8BFB\u53D6"
      },
      source: accOk ? "CF \u8D26\u53F7\u5206\u6790" : cfOk ? "CF Zone" : "CF \u6570\u636E\u4E0D\u53EF\u7528",
      lastUpdated: (/* @__PURE__ */ new Date()).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })
    }
  });
}
__name(handleStatsRequest, "handleStatsRequest");
function normalizePrefix(p) {
  return String(p || "").trim().toLowerCase().replace(/^\/+|\/+$/g, "");
}
__name(normalizePrefix, "normalizePrefix");
function splitTargets(raw) {
  return String(raw == null ? "" : raw).split(/[\r\n,]+/).map((x) => x.trim()).filter(Boolean);
}
__name(splitTargets, "splitTargets");
function normalizeDnsTarget(v) {
  let s = String(v == null ? "" : v).trim();
  s = s.replace(/^https?:\/\//i, "").split("/")[0].split("?")[0].split("#")[0];
  return s.replace(/^\.+|\.+$/g, "").toLowerCase();
}
__name(normalizeDnsTarget, "normalizeDnsTarget");
function validatePrefix(prefix) {
  const a = normalizePrefix(prefix);
  if (!a || !/^[a-z0-9][a-z0-9_-]{0,62}$/i.test(a)) return "\u8DEF\u5F84\u4EC5\u5141\u8BB8\u5B57\u6BCD\u6570\u5B57\u3001\u4E0B\u5212\u7EBF\u548C\u8FDE\u5B57\u7B26";
  if (RESERVED_ALIASES.has(a.toLowerCase())) return "\u8BE5\u8DEF\u5F84\u4E3A\u7CFB\u7EDF\u4FDD\u7559\uFF0C\u4E0D\u53EF\u4F7F\u7528";
  return null;
}
__name(validatePrefix, "validatePrefix");
function validateUserPrefix(prefix) {
  const a = normalizePrefix(prefix);
  if (!a || !/^[a-z0-9][a-z0-9_-]{0,62}$/i.test(a)) return "\u8DEF\u5F84\u4EC5\u5141\u8BB8\u5B57\u6BCD\u6570\u5B57\u3001\u4E0B\u5212\u7EBF\u548C\u8FDE\u5B57\u7B26";
  if (RESERVED_PREFIXES.has(a.toLowerCase())) return "\u8BE5\u8DEF\u5F84\u4E3A\u7CFB\u7EDF\u4FDD\u7559\uFF0C\u4E0D\u53EF\u4F7F\u7528";
  return null;
}
__name(validateUserPrefix, "validateUserPrefix");
var ownerCache = /* @__PURE__ */ new Map();
function clearOwnerCache() {
  ownerCache.clear();
}
__name(clearOwnerCache, "clearOwnerCache");
async function resolveOwnerFromHost(env2, host) {
  const h = String(host || "").toLowerCase().replace(/:\d+$/, "");
  const base = getBaseDomain(env2);
  const userDomain = getUserDomain(env2);
  if (!h) return "";
  if (h === base || h === userDomain) return "";
  const dnsName = getDnsRecordName(env2);
  if (dnsName && h === toFqdn(dnsName, base)) return "";
  if (h === getStatsHost(env2)) return "";
  const zones = [];
  if (userDomain) zones.push(userDomain);
  if (base && base !== userDomain) zones.push(base);
  let sub = "";
  for (const z of zones) {
    if (h === z) return "";
    if (!h.endsWith("." + z)) continue;
    const cand = h.slice(0, -(z.length + 1));
    if (cand && !cand.includes(".") && !RESERVED_SUBDOMAINS.has(cand)) {
      sub = cand;
      break;
    }
  }
  const lookupOwner = /* @__PURE__ */ __name(async (name) => {
    if (!env2.DB) return "";
    try {
      const row = await env2.DB.prepare("SELECT username FROM users WHERE (subdomain = ? OR username = ?) AND status = 'active'").bind(name, name).first();
      return row && row.username ? row.username : "";
    } catch (_) {
      return "";
    }
  }, "lookupOwner");
  const now = Date.now();
  const cacheKey = sub || h;
  const hit = ownerCache.get(cacheKey);
  if (hit && hit.exp > now) return hit.owner;
  let owner = "";
  if (sub) {
    owner = await lookupOwner(sub) || sub;
  } else {
    const first = h.split(".")[0] || "";
    if (!first || RESERVED_SUBDOMAINS.has(first)) return "";
    owner = await lookupOwner(first);
    if (!owner) return "";
  }
  if (ownerCache.size > 500) ownerCache.clear();
  ownerCache.set(cacheKey, { owner, exp: now + 6e4 });
  return owner;
}
__name(resolveOwnerFromHost, "resolveOwnerFromHost");
async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
__name(readJson, "readJson");
async function handleAdminApi(request, env2, url, session) {
  const adminActor = String(session?.username || "admin");
  if (url.pathname === "/admin/api/logout" && request.method === "POST") return logoutResponse();
  if (!await isAdmin(request, env2)) return new Response("Unauthorized", { status: 401 });
  if (request.method !== "GET" && request.method !== "HEAD") {
    const origin = request.headers.get("Origin");
    if (origin && origin !== url.origin) return json({ error: "Forbidden origin" }, 403);
  }
  if (url.pathname === "/admin/api/report/send" && request.method === "POST") {
    const out = await sendDailyReport(env2, url.searchParams.get("date") || "");
    await auditLog(env2, "report.send", out.ok ? "ok" : "fail: " + (out.telegram.rawError || out.telegram.error || out.webhook.error || "unknown"));
    return json({
      success: out.ok,
      date: out.date,
      telegram: out.telegram,
      webhook: out.webhook,
      preview: out.text,
      hint: out.ok ? "" : reportFailureHint(env2, out)
    }, out.ok ? 200 : 502);
  }
  if (url.pathname === "/admin/api/stats" && request.method === "GET") {
    return handleStatsRequest(env2, url);
  }
  if (url.pathname === "/admin/api/settings") {
    if (request.method === "GET") {
      const st = await getSettings(env2);
      const safeRaw = { ...st.raw };
      if (safeRaw.relay_secret) safeRaw.relay_secret = safeRaw.relay_secret.slice(0, 6) + "...";
      return json({
        success: true,
        settings: safeRaw,
        notify: {
          telegram: Boolean(getTelegramToken(env2) && getTelegramChatId(env2)),
          webhook: Boolean(env2.NOTIFY_WEBHOOK),
          tokenVar: getTelegramToken(env2) ? "\u5DF2\u8BFB\u53D6" : "\u672A\u8BFB\u53D6",
          chatVar: getTelegramChatId(env2) ? "\u5DF2\u8BFB\u53D6" : "\u672A\u8BFB\u53D6"
        }
      });
    }
    if (request.method === "POST") {
      const data = await readJson(request) || {};
      if (data.domain_proxy_rules) {
        try {
          const o = JSON.parse(data.domain_proxy_rules);
          if (!o || typeof o !== "object" || Array.isArray(o)) throw 0;
        } catch {
          return json({ error: '\u57DF\u540D\u6620\u5C04\u89C4\u5219\u5FC5\u987B\u662F JSON \u5BF9\u8C61\uFF0C\u4F8B\u5982 {"example.com":"1.2.3.4"}' }, 400);
        }
      }
      for (const k of SETTING_KEYS) if (k in data) await setSetting(env2, k, data[k] ?? "");
      await auditLog(env2, "settings", Object.keys(data).filter((k) => SETTING_KEYS.includes(k)).join(","));
      return json({ success: true });
    }
  }
  if (url.pathname === "/admin/api/relay" && request.method === "GET") {
    const st = await getSettings(env2);
    return json({
      success: true,
      relay_url: st.relayUrl,
      relay_enabled: st.relayEnabled ? "1" : "0",
      has_secret: !!st.relaySecret,
      secret_hint: st.relaySecret ? st.relaySecret.slice(0, 6) + "..." + st.relaySecret.slice(-4) : "",
      active: !!(st.relayEnabled && st.relayUrl && st.relaySecret)
    });
  }
  if (url.pathname === "/admin/api/relay" && request.method === "POST") {
    const data = await readJson(request) || {};
    const url2 = String(data.relay_url ?? "").trim();
    if (url2) {
      const u = normalizeRelayBase(url2);
      if (!/^https?:\/\//i.test(u)) return json({ error: "\u4E2D\u7EE7\u5730\u5740\u5FC5\u987B\u662F http(s):// \u5F00\u5934" }, 400);
      await setSetting(env2, "relay_url", u);
    }
    const secret = String(data.relay_secret ?? "").trim();
    if (secret) await setSetting(env2, "relay_secret", secret);
    if (data.relay_enabled != null) await setSetting(env2, "relay_enabled", data.relay_enabled === "1" || data.relay_enabled === true ? "1" : "0");
    await auditLog(env2, "relay.save", `url=${url2 ? "\u5DF2\u66F4\u65B0" : "\u672A\u53D8"} secret=${secret ? "\u5DF2\u66F4\u65B0" : "\u672A\u53D8"} enabled=${data.relay_enabled != null ? data.relay_enabled : "\u672A\u53D8"}`);
    return json({ success: true });
  }
  if (url.pathname === "/admin/api/relay/test" && request.method === "POST") {
    const st = await getSettings(env2);
    const base = normalizeRelayBase(st.relayUrl);
    if (!base || !st.relaySecret) return json({ ok: false, error: "\u8BF7\u5148\u586B\u5199\u4E2D\u7EE7\u5730\u5740\u548C\u5BC6\u94A5\u5E76\u4FDD\u5B58" });
    const t0 = Date.now();
    try {
      const res = await fetch(new Request(base + "/_relay/health", { headers: { "X-Relay-Key": st.relaySecret } }));
      const text = (await res.text()).slice(0, 400);
      let body = null;
      try {
        body = JSON.parse(text);
      } catch (_) {
      }
      const result = { ok: res.ok, status: res.status, ms: Date.now() - t0, version: body?.version || "", limits: body?.limits || null, usage: body?.usage || null };
      if (res.ok && !st.relayEnabled) {
        await setSetting(env2, "relay_enabled", "1");
        result.auto_enabled = true;
      }
      if (res.ok) {
        try {
          await auditLog(env2, "relay.test.ok", `${base} ${result.ms}ms ${result.version}`);
        } catch (_) {
        }
      }
      return json(result);
    } catch (e) {
      return json({ ok: false, ms: Date.now() - t0, error: String(e?.message || e).slice(0, 200) });
    }
  }
  if (url.pathname === "/admin/api/relay/usage" && request.method === "GET") {
    const st = await getSettings(env2);
    const base = normalizeRelayBase(st.relayUrl);
    if (!base || !st.relaySecret) return json({ ok: false, error: "\u672A\u914D\u7F6E\u4E2D\u7EE7" });
    let fallback24 = 0, fallbackErr24 = 0;
    try {
      const since = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      const { results } = await env2.DB.prepare(
        `SELECT action, COUNT(*) AS n FROM audit_log
         WHERE action IN ('relay.fallback', 'relay.fallback.err') AND substr(ts, 1, 10) >= ?
         GROUP BY action`
      ).bind(since).all();
      for (const row of results || []) {
        if (row.action === "relay.fallback") fallback24 = Number(row.n) || 0;
        if (row.action === "relay.fallback.err") fallbackErr24 = Number(row.n) || 0;
      }
    } catch (_) {
    }
    try {
      const res = await fetch(new Request(base + "/_relay/health", { headers: { "X-Relay-Key": st.relaySecret } }));
      const body = await res.json().catch(() => null);
      return json({ ok: res.ok, usage: body?.usage || null, limits: body?.limits || null, version: body?.version || "", uptime: body?.uptime || "", fallback24, fallbackErr24 });
    } catch (e) {
      return json({ ok: false, error: String(e?.message || e).slice(0, 200), fallback24, fallbackErr24 });
    }
  }
  if (url.pathname === "/admin/api/audit" && request.method === "GET") {
    const { results } = await env2.DB.prepare("SELECT ts, action, detail FROM audit_log ORDER BY id DESC LIMIT 100").all();
    return json({ success: true, logs: results || [] });
  }
  if (url.pathname === "/admin/api/export" && request.method === "GET") {
    const routes = (await env2.DB.prepare("SELECT prefix, target, remark, cache_img, compat_mode, ip_mode, sort_order, enabled, custom_headers, ip_allow, ip_block FROM routes WHERE created_by = ? ORDER BY sort_order, prefix").bind(adminActor).all()).results || [];
    const domains = (await env2.DB.prepare("SELECT domain, name FROM optimized_domains WHERE is_builtin = 0").all()).results || [];
    const st = await getSettings(env2);
    const body = JSON.stringify({ version: CURRENT_VERSION, exportedAt: (/* @__PURE__ */ new Date()).toISOString(), routes, domains, settings: st.raw }, null, 2);
    return new Response(body, { headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="proxy-config-' + (/* @__PURE__ */ new Date()).toISOString().slice(0, 10) + '.json"',
      "Cache-Control": "no-store"
    } });
  }
  if (url.pathname === "/admin/api/import" && request.method === "POST") {
    const data = await readJson(request);
    if (!data || typeof data !== "object") return json({ error: "\u4E0D\u662F\u5408\u6CD5\u7684\u914D\u7F6E JSON" }, 400);
    const stmts = [];
    let nr = 0, nd = 0;
    const skipped = [];
    const existingRows = (await env2.DB.prepare("SELECT rowid AS _rid, prefix, created_by FROM routes").all()).results || [];
    const ownerByPrefix = new Map(existingRows.map((x) => [x.prefix, x]));
    for (const r of Array.isArray(data.routes) ? data.routes : []) {
      const err = validatePrefix(r?.prefix);
      const targets = splitTargets(r?.target);
      if (err || !targets.length || !targets.every(isValidHttpUrl) || parseHeaderLines(r.custom_headers).error || !validIpList(parseIpList(r.ip_allow)) || !validIpList(parseIpList(r.ip_block))) {
        skipped.push(String(r?.prefix || "?"));
        continue;
      }
      const pf = normalizePrefix(r.prefix);
      const cur = ownerByPrefix.get(pf);
      if (cur !== void 0 && (cur.created_by || "") !== adminActor) {
        skipped.push(pf);
        continue;
      }
      const commonArgs = [
        targets.join(","),
        String(r.remark || ""),
        r.cache_img === "off" ? "off" : "on",
        r.compat_mode === "on" ? "on" : "off",
        normalizeIpMode(r.ip_mode),
        Number(r.sort_order) || 0,
        r.enabled === 0 ? 0 : 1,
        String(r.custom_headers || ""),
        String(r.ip_allow || ""),
        String(r.ip_block || ""),
        adminActor
      ];
      if (cur !== void 0) {
        stmts.push(env2.DB.prepare(
          `UPDATE routes SET target = ?, remark = ?, cache_img = ?, compat_mode = ?, ip_mode = ?,
             sort_order = ?, enabled = ?, custom_headers = ?, ip_allow = ?, ip_block = ?, created_by = ?
           WHERE rowid = ?`
        ).bind(...commonArgs, cur._rid));
      } else {
        stmts.push(env2.DB.prepare(
          `INSERT INTO routes (target, remark, cache_img, compat_mode, ip_mode, sort_order, enabled, custom_headers, ip_allow, ip_block, created_by, prefix, last_play)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '')`
        ).bind(...commonArgs, pf));
      }
      nr++;
    }
    for (const d of Array.isArray(data.domains) ? data.domains : []) {
      const domain2 = normalizeDomain(d?.domain);
      const name = String(d?.name || "").trim();
      if (!domain2 || !name) continue;
      stmts.push(env2.DB.prepare("INSERT OR IGNORE INTO optimized_domains (domain, name, is_builtin) VALUES (?, ?, 0)").bind(domain2, name));
      nd++;
    }
    if (data.settings && typeof data.settings === "object") {
      for (const k of SETTING_KEYS) if (k in data.settings) {
        stmts.push(env2.DB.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(k, String(data.settings[k] ?? "")));
      }
    }
    if (stmts.length) await env2.DB.batch(stmts);
    clearRouteCache();
    settingsCache = { exp: 0, v: null };
    await auditLog(env2, "import", `routes=${nr} domains=${nd} skipped=${skipped.length}`);
    return json({ success: true, routes: nr, domains: nd, skipped });
  }
  if (url.pathname === "/admin/api/routes/toggle" && request.method === "POST") {
    const data = await readJson(request) || {};
    const prefix = normalizePrefix(data.prefix);
    if (!prefix) return json({ error: "\u7F3A\u5C11 prefix" }, 400);
    const res = await env2.DB.prepare("UPDATE routes SET enabled = ? WHERE prefix = ? AND created_by = ?").bind(data.enabled ? 1 : 0, prefix, adminActor).run();
    if (!res.meta?.changes) return json({ error: "\u8DEF\u7531\u4E0D\u5B58\u5728\u6216\u65E0\u6743\u64CD\u4F5C" }, 404);
    clearRouteCache();
    await auditLog(env2, data.enabled ? "route.enable" : "route.disable", "/" + prefix);
    return json({ success: true });
  }
  if (url.pathname === "/admin/api/routes/reorder" && request.method === "POST") {
    const data = await readJson(request) || {};
    const order = Array.isArray(data.order) ? data.order.map(normalizePrefix).filter(Boolean) : [];
    if (!order.length) return json({ error: "\u7F3A\u5C11 order" }, 400);
    await env2.DB.batch(order.map((pf, i) => env2.DB.prepare("UPDATE routes SET sort_order = ? WHERE prefix = ? AND created_by = ?").bind(i, pf, adminActor)));
    return json({ success: true });
  }
  if (url.pathname === "/admin/api/routes/test" && request.method === "POST") {
    const data = await readJson(request) || {};
    const route = await env2.DB.prepare("SELECT target FROM routes WHERE prefix = ? AND created_by = ?").bind(normalizePrefix(data.prefix), adminActor).first();
    if (!route) return json({ error: "\u8DEF\u7531\u4E0D\u5B58\u5728\u6216\u65E0\u6743\u64CD\u4F5C" }, 404);
    const targets = splitTargets(route.target);
    const results = await Promise.all(targets.map(async (t) => ({ target: t, ...await probeTarget(t) })));
    return json({ success: true, results });
  }
  if (url.pathname === "/admin/api/health/run" && request.method === "POST") {
    const out = await runHealthCheck(env2, true);
    return json({ success: true, ...out });
  }
  if (url.pathname === "/admin/api/routes") {
    if (request.method === "GET") {
      const today = getShanghaiParts().dateKey;
      const { results } = await env2.DB.prepare(
        `SELECT r.*, COALESCE(s.request_count, 0) AS today_req, COALESCE(s.traffic_bytes, 0) AS today_bytes
         FROM routes r LEFT JOIN route_stats_daily s ON s.prefix = r.prefix AND s.bucket_date = ?
         WHERE r.created_by = ?
         ORDER BY r.sort_order, r.prefix`
      ).bind(today, adminActor).all();
      let health = [];
      try {
        health = (await env2.DB.prepare("SELECT prefix, down FROM route_health").all()).results || [];
      } catch (_) {
      }
      const downMap = {};
      for (const h of health) if (h.down) downMap[h.prefix] = (downMap[h.prefix] || 0) + 1;
      return json((results || []).map((r) => ({ ...r, down_count: downMap[r.prefix] || 0 })));
    }
    if (request.method === "POST") {
      const data = await readJson(request);
      if (!data) return json({ error: "\u8BF7\u6C42\u4F53\u4E0D\u662F\u5408\u6CD5 JSON" }, 400);
      const err = validatePrefix(data.prefix);
      if (err) return json({ error: err }, 400);
      const prefix = normalizePrefix(data.prefix);
      const oldPrefix = data.oldPrefix ? normalizePrefix(data.oldPrefix) : "";
      const targets = splitTargets(data.target);
      if (!targets.length) return json({ error: "\u8BF7\u81F3\u5C11\u586B\u5199\u4E00\u4E2A\u76EE\u6807\u5730\u5740" }, 400);
      const badTarget = targets.find((t) => !isValidHttpUrl(t));
      if (badTarget) return json({ error: "\u76EE\u6807\u5730\u5740\u5FC5\u987B\u662F http(s):// \u5F00\u5934\u7684\u5408\u6CD5 URL\uFF1A" + badTarget }, 400);
      const hdrCheck = parseHeaderLines(data.custom_headers);
      if (hdrCheck.error) return json({ error: hdrCheck.error }, 400);
      const allowList = parseIpList(data.ip_allow);
      const blockList = parseIpList(data.ip_block);
      if (!validIpList(allowList) || !validIpList(blockList)) return json({ error: "IP \u9ED1\u767D\u540D\u5355\u683C\u5F0F\u4E0D\u5408\u6CD5\uFF08\u652F\u6301 IPv4\u3001IPv6 \u548C IPv4 CIDR\uFF0C\u7528\u9017\u53F7\u6216\u7A7A\u683C\u5206\u9694\uFF09" }, 400);
      const isRename = oldPrefix && oldPrefix !== prefix;
      const hasLegacy = await routesHasUserId(env2);
      const globalScope = hasLegacy ? " AND (user_id IS NULL OR user_id = 0 OR user_id = '')" : "";
      const existing = await env2.DB.prepare(
        "SELECT rowid AS _rid, sort_order, last_play, enabled, created_by FROM routes WHERE prefix = ?" + globalScope
      ).bind(isRename ? oldPrefix : prefix).first();
      if (isRename) {
        if (!existing) return json({ error: "\u539F\u8DEF\u7531\u4E0D\u5B58\u5728" }, 404);
        if ((existing.created_by || "") !== adminActor) return json({ error: "\u65E0\u6743\u4FEE\u6539\u5176\u4ED6\u7BA1\u7406\u5458\u6216\u5386\u53F2\u8DEF\u7531" }, 403);
        const clash = await env2.DB.prepare("SELECT 1 AS x FROM routes WHERE prefix = ?" + globalScope).bind(prefix).first();
        if (clash) return json({ error: "\u8DEF\u5F84 /" + prefix + " \u5DF2\u5B58\u5728" }, 409);
      } else if (oldPrefix) {
        if (!existing) return json({ error: "\u8DEF\u7531\u4E0D\u5B58\u5728" }, 404);
        if ((existing.created_by || "") !== adminActor) return json({ error: "\u65E0\u6743\u4FEE\u6539\u5176\u4ED6\u7BA1\u7406\u5458\u6216\u5386\u53F2\u8DEF\u7531" }, 403);
      } else if (existing) {
        if ((existing.created_by || "") === adminActor) return json({ error: "\u8DEF\u5F84 /" + prefix + " \u5DF2\u5B58\u5728\uFF0C\u8BF7\u76F4\u63A5\u7F16\u8F91\u5B83" }, 409);
        return json({ error: "\u8DEF\u5F84 /" + prefix + " \u5DF2\u88AB\u5176\u4ED6\u7BA1\u7406\u5458\u6216\u5386\u53F2\u8DEF\u7531\u5360\u7528" }, 409);
      }
      if (oldPrefix) {
        await env2.DB.prepare(
          `UPDATE routes SET prefix = ?, target = ?, remark = ?, cache_img = ?, compat_mode = ?, ip_mode = ?,
             custom_headers = ?, ip_allow = ?, ip_block = ?, created_by = ?
           WHERE rowid = ? AND created_by = ?`
        ).bind(
          prefix,
          targets.join(","),
          String(data.remark || ""),
          data.cache_img === "off" ? "off" : "on",
          data.compat_mode === "on" ? "on" : "off",
          normalizeIpMode(data.ip_mode),
          String(data.custom_headers || "").trim(),
          allowList.join(","),
          blockList.join(","),
          adminActor,
          existing._rid,
          adminActor
        ).run();
      } else {
        await env2.DB.prepare(
          "INSERT INTO routes (prefix, target, remark, cache_img, compat_mode, ip_mode, last_play, sort_order, enabled, custom_headers, ip_allow, ip_block, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(
          prefix,
          targets.join(","),
          String(data.remark || ""),
          data.cache_img === "off" ? "off" : "on",
          data.compat_mode === "on" ? "on" : "off",
          normalizeIpMode(data.ip_mode),
          "",
          0,
          1,
          String(data.custom_headers || "").trim(),
          allowList.join(","),
          blockList.join(","),
          adminActor
        ).run();
      }
      clearRouteCache();
      await auditLog(env2, isRename ? "route.rename" : "route.save", "/" + (isRename ? oldPrefix + " \u2192 /" : "") + prefix);
      return json({ success: true });
    }
    if (request.method === "DELETE") {
      const prefix = url.searchParams.get("prefix");
      if (!prefix) return json({ error: "\u7F3A\u5C11 prefix \u53C2\u6570" }, 400);
      const p = normalizePrefix(prefix);
      const res = await env2.DB.prepare("DELETE FROM routes WHERE prefix = ? AND created_by = ?").bind(p, adminActor).run();
      if (!res.meta?.changes) return json({ error: "\u8DEF\u7531\u4E0D\u5B58\u5728\u6216\u65E0\u6743\u64CD\u4F5C" }, 404);
      clearRouteCache();
      try {
        await env2.DB.prepare("DELETE FROM route_health WHERE prefix = ?").bind(p).run();
      } catch (_) {
      }
      await auditLog(env2, "route.delete", "/" + p);
      return json({ success: true });
    }
  }
  if (url.pathname === "/admin/api/optimized-domains") {
    if (request.method === "GET") {
      const domains = await getOptimizedDomains(env2);
      return json({ success: true, domains });
    }
    if (request.method === "POST") {
      const data = await readJson(request);
      const domain2 = normalizeDomain(data?.domain);
      const name = String(data?.name || "").trim();
      if (!domain2 || !name) return json({ success: false, error: "\u57DF\u540D\u6216\u540D\u79F0\u4E0D\u5408\u6CD5" }, 400);
      try {
        const success = await addOptimizedDomain(env2, domain2, name);
        await auditLog(env2, "domain.add", domain2);
        return json({ success });
      } catch (e) {
        if (/UNIQUE/i.test(String(e?.message))) return json({ success: false, error: "\u8BE5\u57DF\u540D\u5DF2\u5B58\u5728" }, 409);
        return json({ success: false, error: "\u4FDD\u5B58\u5931\u8D25" }, 500);
      }
    }
  }
  if (url.pathname.startsWith("/admin/api/optimized-domains/")) {
    const id = parseInt(url.pathname.split("/").pop(), 10);
    if (!Number.isFinite(id)) return json({ success: false, error: "id \u4E0D\u5408\u6CD5" }, 400);
    if (request.method === "PUT") {
      const data = await readJson(request);
      const domain2 = normalizeDomain(data?.domain);
      const name = String(data?.name || "").trim();
      if (!domain2 || !name) return json({ success: false, error: "\u57DF\u540D\u6216\u540D\u79F0\u4E0D\u5408\u6CD5" }, 400);
      try {
        const success = await updateOptimizedDomain(env2, id, domain2, name);
        if (!success) return json({ success: false, error: "\u5185\u7F6E\u57DF\u540D\u4E0D\u53EF\u4FEE\u6539\uFF0C\u6216\u8BE5\u8BB0\u5F55\u4E0D\u5B58\u5728" }, 403);
        return json({ success });
      } catch (e) {
        if (/UNIQUE/i.test(String(e?.message))) return json({ success: false, error: "\u8BE5\u57DF\u540D\u5DF2\u5B58\u5728" }, 409);
        return json({ success: false, error: "\u4FDD\u5B58\u5931\u8D25" }, 500);
      }
    }
    if (request.method === "DELETE") {
      const success = await deleteOptimizedDomain(env2, id);
      if (!success) return json({ success: false, error: "\u5185\u7F6E\u57DF\u540D\u4E0D\u53EF\u5220\u9664\uFF0C\u6216\u8BE5\u8BB0\u5F55\u4E0D\u5B58\u5728" }, 403);
      await auditLog(env2, "domain.delete", "id=" + id);
      return json({ success });
    }
  }
  if (url.pathname === "/admin/api/dns-config") {
    if (request.method === "GET") {
      const config2 = await getDNSConfig(env2);
      const zoneInfo = await resolveZoneInfo(env2);
      const baseDomain = getBaseDomain(env2);
      const resolvedName = config2 && config2.dnsName || getDnsRecordName(env2);
      const targetName = toFqdn(resolvedName, baseDomain);
      const candidates = [];
      const accessHost = String(url.hostname || "").toLowerCase();
      if (accessHost) candidates.push(accessHost);
      if (targetName && !candidates.includes(targetName)) candidates.push(targetName);
      let zones = [];
      let zonesError = null;
      let zoneId = zoneInfo.zoneId || config2 && config2.zoneId || "";
      if (!zoneId) {
        zonesError = zoneInfo.error || "\u672A\u89E3\u6790\u5230 Zone ID";
        const zr = await getZones(env2);
        if (zr.success && Array.isArray(zr.result)) {
          zones = zr.result;
          if (zones[0]) zoneId = zones[0].id;
        } else {
          zonesError = zr.errors?.[0]?.message || zr.error || "\u83B7\u53D6\u533A\u57DF\u5217\u8868\u5931\u8D25";
        }
      }
      let liveRecord = null;
      if (zoneId) {
        try {
          const rr = await getDNSRecords(env2, zoneId);
          if (rr.success && Array.isArray(rr.result)) {
            for (const name of candidates) {
              const rec = rr.result.find((r) => ["A", "AAAA", "CNAME"].includes(r.type) && r.name === name);
              if (rec) {
                liveRecord = { type: rec.type, name: rec.name, content: rec.content, proxied: rec.proxied, modifiedOn: rec.modified_on, zoneId };
                break;
              }
            }
          } else if (!zonesError) {
            zonesError = rr.errors?.[0]?.message || rr.error || "\u8BFB\u53D6 DNS \u8BB0\u5F55\u5931\u8D25";
          }
        } catch (e) {
          zonesError = zonesError || String(e?.message || e);
        }
      }
      return json({
        success: true,
        config: config2,
        zones,
        zonesError,
        liveRecord,
        zoneId,
        baseDomain,
        resolvedName,
        targetName,
        statsHost: getStatsHost(env2)
      });
    }
    if (request.method === "POST") {
      const data = await readJson(request) || {};
      const success = await saveDNSConfig(env2, data.dnsName, data.currentDomain || "", data.zoneId || "");
      return json({ success });
    }
  }
  if (url.pathname === "/admin/api/dns/replace" && request.method === "POST") {
    const data = await readJson(request) || {};
    let { zoneId, dnsName, targetDomain } = data;
    const baseDomain = getBaseDomain(env2);
    const nameInput = String(dnsName || "").trim() || getDnsRecordName(env2);
    const targets = splitTargets(targetDomain).map(normalizeDnsTarget).filter(Boolean);
    if (!nameInput || !targets.length) return json({ success: false, error: "\u7F3A\u5C11\u5FC5\u8981\u53C2\u6570\uFF08\u8BB0\u5F55\u540D / \u76EE\u6807\uFF09" }, 400);
    if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(targets[0]) && !targets[0].includes(":") && !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(targets[0])) {
      return json({ success: false, error: "\u76EE\u6807\u5FC5\u987B\u662F\u5408\u6CD5\u57DF\u540D\u3001IPv4 \u6216 IPv6" }, 400);
    }
    if (!zoneId) {
      const info3 = await resolveZoneInfo(env2);
      zoneId = info3.zoneId;
      if (!zoneId) return json({ success: false, error: info3.error || "\u672A\u89E3\u6790\u5230 Zone ID\uFF0C\u8BF7\u68C0\u67E5 CF_API_TOKEN \u6743\u9650" }, 400);
    }
    const result = await createOrUpdateDNSRecord(env2, zoneId, nameInput, targets[0], baseDomain);
    if (result.success && result.result) {
      await saveDNSConfig(env2, nameInput, targets[0], zoneId);
      invalidateZoneInfoCache();
      await auditLog(env2, "dns.replace", `${result.result.name} \u2192 ${result.result.content}`);
      return json({ success: true, result: result.result });
    }
    return json({ success: false, error: result.error || result.errors?.[0]?.message || "DNS \u66FF\u6362\u5931\u8D25", errors: result.errors });
  }
  if (url.pathname === "/admin/api/users") {
    if (request.method === "GET") return json({ success: true, users: await adminListUsers(env2) });
    if (request.method === "POST") {
      const data = await readJson(request) || {};
      const out = await adminCreateUser(env2, data, adminActor);
      return json(out, out.error ? 400 : 200);
    }
  }
  if (url.pathname.startsWith("/admin/api/users/")) {
    const id = parseInt(url.pathname.split("/").pop(), 10);
    if (!Number.isFinite(id)) return json({ error: "id \u4E0D\u5408\u6CD5" }, 400);
    if (request.method === "PUT") {
      const data = await readJson(request) || {};
      const out = await adminUpdateUser(env2, id, data, adminActor);
      return json(out, out.error ? 400 : 200);
    }
    if (request.method === "DELETE") {
      const out = await adminDeleteUser(env2, id, adminActor);
      return json(out, out.error ? 404 : 200);
    }
  }
  if (url.pathname === "/admin/api/invites") {
    if (request.method === "GET") return json({ success: true, invites: await adminListInvites(env2) });
    if (request.method === "POST") {
      const data = await readJson(request) || {};
      const out = await adminCreateInvite(env2, data, adminActor);
      return json(out, out.error ? 400 : 200);
    }
  }
  if (url.pathname === "/admin/api/invites/clear" && request.method === "POST") {
    const out = await adminClearInvites(env2, adminActor);
    return json(out, out.error ? 400 : 200);
  }
  if (url.pathname.startsWith("/admin/api/invites/") && request.method === "DELETE") {
    const code = decodeURIComponent(url.pathname.split("/").pop() || "");
    const out = await adminDeleteInvite(env2, code, "admin");
    return json(out, out.error ? 404 : 200);
  }
  if (url.pathname === "/admin/api/db/reset" && request.method === "POST") {
    const data = await readJson(request) || {};
    const out = await adminResetData(env2, data, adminActor);
    return json(out, out.error ? 400 : 200);
  }
  return json({ error: "Not found" }, 404);
}
__name(handleAdminApi, "handleAdminApi");
async function adminListUsers(env2) {
  const today = getShanghaiParts().dateKey;
  const hasLegacy = await routesHasUserId(env2);
  const rcSql = hasLegacy ? `LEFT JOIN (
         SELECT owner, COUNT(DISTINCT prefix) AS cnt FROM (
           SELECT owner, prefix FROM user_routes
           UNION
           SELECT u2.username AS owner, r.prefix FROM routes r JOIN users u2 ON u2.id = r.user_id
         ) GROUP BY owner
       ) rc ON rc.owner = u.username` : `LEFT JOIN (SELECT owner, COUNT(*) AS cnt FROM user_routes GROUP BY owner) rc ON rc.owner = u.username`;
  const { results } = await env2.DB.prepare(
    `SELECT u.*, COALESCE(s.req, 0) AS today_req, COALESCE(s.bytes, 0) AS today_bytes,
            COALESCE(rc.cnt, 0) AS route_count
     FROM users u
     LEFT JOIN (
       SELECT substr(prefix, 1, instr(prefix, '/') - 1) AS owner,
              SUM(request_count) AS req, SUM(traffic_bytes) AS bytes
       FROM route_stats_daily
       WHERE bucket_date = ? AND instr(prefix, '/') > 0
       GROUP BY owner
     ) s ON s.owner = u.username
     ${rcSql}
     ORDER BY u.id`
  ).bind(today).all();
  return (results || []).map((r) => ({
    ...publicUser(rowToUser(r)),
    todayRequests: Number(r.today_req) || 0,
    todayTraffic: Number(r.today_bytes) || 0,
    routeCount: Number(r.route_count) || 0
  }));
}
__name(adminListUsers, "adminListUsers");
async function adminCreateUser(env2, data, actor) {
  const username = sanitizeUsername(data.username);
  const password = String(data.password || "");
  const subdomain = sanitizeSubdomain(data.subdomain) || sanitizeSubdomain(username);
  const role = data.role === "admin" ? "admin" : "user";
  const status = data.status === "disabled" ? "disabled" : "active";
  const routeLimit = Math.max(1, Math.min(200, parseInt(data.route_limit, 10) || DEFAULT_USER_ROUTE_LIMIT));
  if (!username) return { error: "\u7528\u6237\u540D\u9700\u4E3A 3-32 \u4F4D\u5C0F\u5199\u5B57\u6BCD\u3001\u6570\u5B57\u6216\u77ED\u6A2A\u7EBF\uFF0C\u4E14\u4E0D\u80FD\u4EE5\u77ED\u6A2A\u7EBF\u5F00\u5934/\u7ED3\u5C3E" };
  if (password.length < 6) return { error: "\u5BC6\u7801\u81F3\u5C11 6 \u4F4D" };
  if (!subdomain) return { error: "\u5B50\u57DF\u540D\u4E0D\u5408\u6CD5" };
  const entryErr = entryNameError(env2, subdomain);
  if (entryErr) return { error: entryErr };
  const exists = await env2.DB.prepare("SELECT 1 AS x FROM users WHERE username = ? OR subdomain = ?").bind(username, subdomain).first();
  if (exists) return { error: "\u7528\u6237\u540D\u6216\u5B50\u57DF\u540D\u5DF2\u88AB\u5360\u7528" };
  const salt = randomHex(16);
  const hash = await hashPassword(password, salt);
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  let created = null;
  try {
    const res = await env2.DB.prepare(
      "INSERT INTO users (username, password_hash, salt, role, status, subdomain, route_limit, created_at, last_login) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(username, hash, salt, role, status, subdomain, routeLimit, nowIso, "").run();
    clearUserCache();
    await auditLog(env2, "user.create", actor + " -> " + username + " / " + subdomain);
    created = { id: res.meta?.last_row_id, username, role, status, subdomain, routeLimit };
  } catch (e) {
    return { error: /UNIQUE/i.test(String(e?.message)) ? "\u7528\u6237\u540D\u6216\u5B50\u57DF\u540D\u5DF2\u88AB\u5360\u7528" : "\u521B\u5EFA\u5931\u8D25" };
  }
  const user = await getUserByUsername(env2, username);
  const dns = user ? await provisionUserDns(env2, user) : { ok: false, error: "\u8BFB\u53D6\u7528\u6237\u5931\u8D25" };
  return dns.ok ? { user: created, dns: { entryHost: dns.entryHost, target: dns.target, type: dns.type } } : { user: created, dnsWarning: dns.error };
}
__name(adminCreateUser, "adminCreateUser");
async function adminUpdateUser(env2, id, data, actor) {
  const user = await getUserById(env2, id);
  if (!user) return { error: "\u7528\u6237\u4E0D\u5B58\u5728" };
  const fields = [];
  const changed = [];
  const args = [];
  let subdomain = user.subdomain;
  if (data.subdomain !== void 0) {
    subdomain = sanitizeSubdomain(data.subdomain) || sanitizeSubdomain(user.username);
    if (!subdomain) return { error: "\u5B50\u57DF\u540D\u4E0D\u5408\u6CD5" };
    if (RESERVED_SUBDOMAINS.has(subdomain)) return { error: "\u8BE5\u5B50\u57DF\u540D\u4E0D\u53EF\u7528" };
    const clash = await env2.DB.prepare("SELECT 1 AS x FROM users WHERE subdomain = ? AND id <> ?").bind(subdomain, id).first();
    if (clash) return { error: "\u5B50\u57DF\u540D\u5DF2\u88AB\u5360\u7528" };
    fields.push("subdomain = ?");
    changed.push("subdomain");
    args.push(subdomain);
  }
  if (data.role !== void 0) {
    fields.push("role = ?");
    changed.push("role");
    args.push(data.role === "admin" ? "admin" : "user");
  }
  if (data.status !== void 0) {
    fields.push("status = ?");
    changed.push("status");
    args.push(data.status === "disabled" ? "disabled" : "active");
  }
  if (data.route_limit !== void 0) {
    const limit = Math.max(1, Math.min(200, parseInt(data.route_limit, 10) || DEFAULT_USER_ROUTE_LIMIT));
    fields.push("route_limit = ?");
    changed.push("route_limit");
    args.push(limit);
  }
  if (data.password) {
    if (String(data.password).length < 6) return { error: "\u5BC6\u7801\u81F3\u5C11 6 \u4F4D" };
    const salt = randomHex(16);
    fields.push("password_hash = ?", "salt = ?");
    changed.push("password");
    args.push(await hashPassword(String(data.password), salt), salt);
  }
  if (!fields.length) return { error: "\u6CA1\u6709\u9700\u8981\u66F4\u65B0\u7684\u5B57\u6BB5" };
  args.push(id);
  await env2.DB.prepare("UPDATE users SET " + fields.join(", ") + " WHERE id = ?").bind(...args).run();
  clearUserCache();
  await auditLog(env2, "user.update", actor + " -> " + user.username + " (" + changed.join(",") + ")");
  const updated = await getUserById(env2, id);
  return { user: publicUser(updated) };
}
__name(adminUpdateUser, "adminUpdateUser");
async function adminDeleteUser(env2, id, actor) {
  const user = await getUserById(env2, id);
  if (!user) return { error: "\u7528\u6237\u4E0D\u5B58\u5728" };
  await env2.DB.batch([
    env2.DB.prepare("DELETE FROM user_routes WHERE owner = ?").bind(user.username),
    env2.DB.prepare("DELETE FROM user_stats_hourly WHERE owner = ?").bind(user.username),
    env2.DB.prepare("DELETE FROM route_stats_daily WHERE prefix LIKE ? ESCAPE '!'").bind(escapeLike(user.username) + "/%"),
    env2.DB.prepare("DELETE FROM users WHERE id = ?").bind(id)
  ]);
  clearUserCache();
  clearRouteCache();
  await auditLog(env2, "user.delete", actor + " -> " + user.username);
  return { ok: true };
}
__name(adminDeleteUser, "adminDeleteUser");
async function adminListInvites(env2) {
  const { results } = await env2.DB.prepare("SELECT * FROM invite_codes ORDER BY created_at DESC, code").all();
  return (results || []).map((r) => ({
    code: r.code,
    maxUses: Number(r.max_uses) || 0,
    usedCount: Number(r.used_count) || 0,
    expiresAt: r.expires_at || "",
    note: r.note || "",
    createdBy: r.created_by || "",
    createdAt: r.created_at || ""
  }));
}
__name(adminListInvites, "adminListInvites");
async function adminCreateInvite(env2, data, actor) {
  const code = String(data.code || "").trim().toUpperCase() || makeInviteCode();
  if (!/^[A-Z0-9-]{4,32}$/.test(code)) return { error: "\u9080\u8BF7\u7801\u4EC5\u5141\u8BB8 4-32 \u4F4D\u5B57\u6BCD\u3001\u6570\u5B57\u548C\u77ED\u6A2A\u7EBF" };
  const maxUses = Math.max(0, Math.min(1e4, parseInt(data.max_uses, 10) || 1));
  const expiresAt = String(data.expires_at || "").trim();
  if (expiresAt && isNaN(new Date(expiresAt).getTime())) return { error: "\u8FC7\u671F\u65F6\u95F4\u683C\u5F0F\u4E0D\u6B63\u786E" };
  const note = String(data.note || "").slice(0, 200);
  try {
    await env2.DB.prepare("INSERT INTO invite_codes (code, max_uses, used_count, expires_at, note, created_by, created_at) VALUES (?, ?, 0, ?, ?, ?, ?)").bind(code, maxUses, expiresAt, note, actor, (/* @__PURE__ */ new Date()).toISOString()).run();
    await auditLog(env2, "invite.create", actor + " -> " + code);
    return { invite: { code, maxUses, usedCount: 0, expiresAt, note, createdBy: actor } };
  } catch (e) {
    const msg = String(e?.message || e || "");
    return { error: /UNIQUE/i.test(msg) ? "\u9080\u8BF7\u7801\u5DF2\u5B58\u5728" : "\u521B\u5EFA\u5931\u8D25: " + msg };
  }
}
__name(adminCreateInvite, "adminCreateInvite");
async function adminClearInvites(env2, actor) {
  let deleted = 0;
  try {
    const row = await env2.DB.prepare("SELECT COUNT(*) AS n FROM invite_codes").first();
    deleted = Number(row?.n) || 0;
  } catch (_) {
  }
  const res = await env2.DB.prepare("DELETE FROM invite_codes").run();
  if (Number(res.meta?.changes) > 0) deleted = Number(res.meta.changes);
  await auditLog(env2, "invite.clear", actor + " -> " + deleted);
  return { ok: true, deleted };
}
__name(adminClearInvites, "adminClearInvites");
async function adminDeleteInvite(env2, code, actor) {
  const raw = String(code || "").trim();
  const upper = raw.toUpperCase();
  if (!raw) return { error: "\u9080\u8BF7\u7801\u4E0D\u80FD\u4E3A\u7A7A" };
  let row = await env2.DB.prepare("SELECT code FROM invite_codes WHERE code = ? OR code = ? LIMIT 1").bind(raw, upper).first();
  if (!row) row = await env2.DB.prepare("SELECT code FROM invite_codes WHERE UPPER(code) = ? LIMIT 1").bind(upper).first();
  if (!row) return { ok: true, alreadyDeleted: true };
  const res = await env2.DB.prepare("DELETE FROM invite_codes WHERE code = ?").bind(row.code).run();
  if (!res.meta?.changes) return { error: "\u5220\u9664\u5931\u8D25\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5" };
  await auditLog(env2, "invite.delete", actor + " -> " + row.code);
  return { ok: true };
}
__name(adminDeleteInvite, "adminDeleteInvite");
async function adminResetData(env2, data, actor) {
  if (String(data.confirm || "") !== "RESET") return { error: "\u8BF7\u8F93\u5165 RESET \u786E\u8BA4" };
  const scope = String(data.scope || "stats");
  const jobs = [];
  if (scope === "stats" || scope === "all") {
    jobs.push(
      env2.DB.prepare("DELETE FROM proxy_stats_hourly"),
      env2.DB.prepare("DELETE FROM route_stats_daily"),
      env2.DB.prepare("DELETE FROM user_stats_hourly"),
      env2.DB.prepare("DELETE FROM route_health"),
      env2.DB.prepare("DELETE FROM audit_log")
    );
    statsBuffer.clear();
    routeStatsBuffer.clear();
    userStatsBuffer.clear();
    statsBufferCount = 0;
  }
  if (scope === "users" || scope === "all") {
    jobs.push(
      env2.DB.prepare("DELETE FROM user_routes"),
      env2.DB.prepare("DELETE FROM user_stats_hourly"),
      env2.DB.prepare("DELETE FROM route_stats_daily WHERE instr(prefix, '/') > 0"),
      env2.DB.prepare("DELETE FROM invite_codes"),
      env2.DB.prepare("DELETE FROM users")
    );
    clearUserCache();
    clearRouteCache();
  }
  if (!jobs.length) return { error: "\u672A\u77E5\u7684\u6E05\u7406\u8303\u56F4" };
  await env2.DB.batch(jobs);
  await auditLog(env2, "db.reset", actor + " -> " + scope);
  return { ok: true, scope };
}
__name(adminResetData, "adminResetData");
function userEntryHost(env2, user) {
  const root = getUserDomain(env2) || getBaseDomain(env2);
  const sub = user && user.subdomain || user && user.username || "";
  return toFqdn(sub, root);
}
__name(userEntryHost, "userEntryHost");
var routesHasUserIdCache = null;
async function routesHasUserId(env2) {
  if (routesHasUserIdCache !== null) return routesHasUserIdCache;
  try {
    await env2.DB.prepare("SELECT user_id FROM routes LIMIT 1").first();
    routesHasUserIdCache = true;
  } catch (_) {
    routesHasUserIdCache = false;
  }
  return routesHasUserIdCache;
}
__name(routesHasUserId, "routesHasUserId");
async function getUserLegacyRoutes(env2, user, today) {
  if (!user || !await routesHasUserId(env2)) return [];
  try {
    const { results } = await env2.DB.prepare(
      `SELECT r.*,
              COALESCE((SELECT SUM(request_count) FROM route_stats_daily
                        WHERE bucket_date = ? AND prefix IN (r.prefix, ? || '/' || r.prefix)), 0) AS today_req,
              COALESCE((SELECT SUM(traffic_bytes) FROM route_stats_daily
                        WHERE bucket_date = ? AND prefix IN (r.prefix, ? || '/' || r.prefix)), 0) AS today_bytes
       FROM routes r
       JOIN (SELECT prefix, MIN(rowid) AS rid FROM routes WHERE user_id = ? GROUP BY prefix) x
         ON x.rid = r.rowid
       WHERE r.user_id = ?
       ORDER BY r.sort_order, r.prefix`
    ).bind(today, user.username, today, user.username, user.id, user.id).all();
    return results || [];
  } catch (_) {
    return [];
  }
}
__name(getUserLegacyRoutes, "getUserLegacyRoutes");
async function getLegacyRouteForUser(env2, user, id, prefix) {
  if (!user || !await routesHasUserId(env2)) return null;
  try {
    if (id) {
      const row = await env2.DB.prepare("SELECT rowid AS _rid, * FROM routes WHERE id = ? AND user_id = ?").bind(Number(id), user.id).first();
      if (row) return row;
    }
  } catch (_) {
  }
  try {
    return await env2.DB.prepare("SELECT rowid AS _rid, * FROM routes WHERE user_id = ? AND prefix = ? ORDER BY rowid LIMIT 1").bind(user.id, prefix).first();
  } catch (_) {
    return null;
  }
}
__name(getLegacyRouteForUser, "getLegacyRouteForUser");
async function countUserRoutes(env2, user) {
  if (!user) return 0;
  if (await routesHasUserId(env2)) {
    try {
      const c = await env2.DB.prepare(
        "SELECT COUNT(*) AS n FROM (SELECT prefix FROM user_routes WHERE owner = ? UNION SELECT prefix FROM routes WHERE user_id = ?)"
      ).bind(user.username, user.id).first();
      return Number(c?.n) || 0;
    } catch (_) {
    }
  }
  try {
    const c = await env2.DB.prepare("SELECT COUNT(*) AS n FROM user_routes WHERE owner = ?").bind(user.username).first();
    return Number(c?.n) || 0;
  } catch (_) {
    return 0;
  }
}
__name(countUserRoutes, "countUserRoutes");
async function userListRoutes(env2, owner) {
  const today = getShanghaiParts().dateKey;
  const { results } = await env2.DB.prepare(
    `SELECT r.*, COALESCE(s.request_count, 0) AS today_req, COALESCE(s.traffic_bytes, 0) AS today_bytes
     FROM user_routes r
     LEFT JOIN route_stats_daily s ON s.prefix = ? || '/' || r.prefix AND s.bucket_date = ?
     WHERE r.owner = ?
     ORDER BY r.sort_order, r.prefix`
  ).bind(owner, today, owner).all();
  let health = [];
  try {
    health = (await env2.DB.prepare("SELECT prefix, target, down FROM route_health").all()).results || [];
  } catch (_) {
  }
  const downSet = /* @__PURE__ */ new Set();
  for (const h of health) if (h.down) downSet.add(h.prefix + "|" + h.target);
  const countDown = /* @__PURE__ */ __name((keyPrefix, target) => splitTargets(target).filter((t) => downSet.has(keyPrefix + "|" + t)).length, "countDown");
  const user = await getUserByUsername(env2, owner);
  const legacy = await getUserLegacyRoutes(env2, user, today);
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const r of results || []) {
    out.push({ ...r, source: "user", down_count: countDown(owner + "/" + r.prefix, r.target) });
    seen.add(r.prefix);
  }
  for (const r of legacy) {
    if (seen.has(r.prefix)) continue;
    out.push({ ...r, source: "legacy", down_count: countDown(r.prefix, r.target) });
    seen.add(r.prefix);
  }
  return out;
}
__name(userListRoutes, "userListRoutes");
async function userSaveRoute(env2, owner, data) {
  const err = validateUserPrefix(data.prefix);
  if (err) return { error: err };
  const prefix = normalizePrefix(data.prefix);
  const oldPrefix = data.oldPrefix ? normalizePrefix(data.oldPrefix) : "";
  const targets = splitTargets(data.target);
  if (!targets.length) return { error: "\u8BF7\u81F3\u5C11\u586B\u5199\u4E00\u4E2A\u76EE\u6807\u5730\u5740" };
  const badTarget = targets.find((t) => !isValidHttpUrl(t));
  if (badTarget) return { error: "\u76EE\u6807\u5730\u5740\u5FC5\u987B\u662F http(s):// \u5F00\u5934\u7684\u5408\u6CD5 URL\uFF1A" + badTarget };
  const hdrCheck = parseHeaderLines(data.custom_headers);
  if (hdrCheck.error) return { error: hdrCheck.error };
  const allowList = parseIpList(data.ip_allow);
  const blockList = parseIpList(data.ip_block);
  if (!validIpList(allowList) || !validIpList(blockList)) return { error: "IP \u9ED1\u767D\u540D\u5355\u683C\u5F0F\u4E0D\u5408\u6CD5" };
  const user = await getUserByUsername(env2, owner);
  if (!user) return { error: "\u7528\u6237\u4E0D\u5B58\u5728" };
  const limit = user.routeLimit || DEFAULT_USER_ROUTE_LIMIT;
  const isRename = oldPrefix && oldPrefix !== prefix;
  const lookupPrefix = isRename ? oldPrefix : prefix;
  const source = data.source === "legacy" ? "legacy" : "user";
  const routeId = Number(data.routeId || data.id || 0) || 0;
  if (source === "legacy") {
    const row = await getLegacyRouteForUser(env2, user, routeId, lookupPrefix);
    if (!row) return { error: "\u8DEF\u7531\u4E0D\u5B58\u5728\u6216\u4E0D\u5C5E\u4E8E\u5F53\u524D\u8D26\u53F7" };
    if (isRename) {
      const clashUser = await env2.DB.prepare("SELECT 1 AS x FROM user_routes WHERE owner = ? AND prefix = ?").bind(owner, prefix).first();
      if (clashUser) return { error: "\u8DEF\u5F84 /" + prefix + " \u5DF2\u5B58\u5728" };
      const clashLegacy = await env2.DB.prepare("SELECT 1 AS x FROM routes WHERE user_id = ? AND prefix = ? AND rowid <> ?").bind(user.id, prefix, row._rid).first();
      if (clashLegacy) return { error: "\u8DEF\u5F84 /" + prefix + " \u5DF2\u5B58\u5728" };
      const clashOther = await env2.DB.prepare("SELECT 1 AS x FROM routes WHERE prefix = ? AND (user_id IS NULL OR user_id <> ?)").bind(prefix, user.id).first();
      if (clashOther) return { error: "\u8DEF\u5F84 /" + prefix + " \u5DF2\u88AB\u5176\u4ED6\u8DEF\u7531\u5360\u7528" };
    }
    await env2.DB.prepare(
      `UPDATE routes SET prefix = ?, target = ?, remark = ?, cache_img = ?, compat_mode = ?, ip_mode = ?,
        custom_headers = ?, ip_allow = ?, ip_block = ? WHERE rowid = ? AND user_id = ?`
    ).bind(
      prefix,
      targets.join(","),
      String(data.remark || ""),
      data.cache_img === "off" ? "off" : "on",
      data.compat_mode === "on" ? "on" : "off",
      normalizeIpMode(data.ip_mode),
      String(data.custom_headers || "").trim(),
      allowList.join(","),
      blockList.join(","),
      row._rid,
      user.id
    ).run();
    clearRouteCache();
    await auditLog(env2, isRename ? "user.route.rename" : "user.route.save", owner + " /" + prefix + " (\u5386\u53F2\u8DEF\u7531)");
    return { ok: true };
  }
  if (isRename) {
    const clash = await env2.DB.prepare("SELECT 1 AS x FROM user_routes WHERE owner = ? AND prefix = ?").bind(owner, prefix).first();
    if (clash) return { error: "\u8DEF\u5F84 /" + prefix + " \u5DF2\u5B58\u5728" };
  } else if (!oldPrefix) {
    const existing2 = await env2.DB.prepare("SELECT 1 AS x FROM user_routes WHERE owner = ? AND prefix = ?").bind(owner, prefix).first();
    if (existing2) return { error: "\u8DEF\u5F84 /" + prefix + " \u5DF2\u5B58\u5728\uFF0C\u8BF7\u76F4\u63A5\u7F16\u8F91\u5B83" };
    if (await routesHasUserId(env2)) {
      const legacyClash = await env2.DB.prepare("SELECT 1 AS x FROM routes WHERE user_id = ? AND prefix = ?").bind(user.id, prefix).first();
      if (legacyClash) return { error: "\u8DEF\u5F84 /" + prefix + " \u5DF2\u5B58\u5728\uFF0C\u8BF7\u76F4\u63A5\u7F16\u8F91\u5B83" };
    }
    const total = await countUserRoutes(env2, user);
    if (total >= limit) return { error: "\u8DEF\u7531\u6570\u91CF\u5DF2\u8FBE\u4E0A\u9650\uFF08" + limit + " \u6761\uFF09\uFF0C\u8BF7\u8054\u7CFB\u7BA1\u7406\u5458\u8C03\u6574" };
  }
  const existing = await env2.DB.prepare("SELECT sort_order, last_play, enabled FROM user_routes WHERE owner = ? AND prefix = ?").bind(owner, lookupPrefix).first();
  const insert = env2.DB.prepare(
    "INSERT OR REPLACE INTO user_routes (owner, prefix, target, remark, cache_img, compat_mode, ip_mode, last_play, sort_order, enabled, custom_headers, ip_allow, ip_block) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(
    owner,
    prefix,
    targets.join(","),
    String(data.remark || ""),
    data.cache_img === "off" ? "off" : "on",
    data.compat_mode === "on" ? "on" : "off",
    normalizeIpMode(data.ip_mode),
    existing?.last_play || "",
    existing?.sort_order || 0,
    existing?.enabled === 0 ? 0 : 1,
    String(data.custom_headers || "").trim(),
    allowList.join(","),
    blockList.join(",")
  );
  if (isRename) {
    await env2.DB.batch([insert, env2.DB.prepare("DELETE FROM user_routes WHERE owner = ? AND prefix = ?").bind(owner, oldPrefix)]);
  } else {
    await insert.run();
  }
  clearRouteCache();
  await auditLog(env2, "user.route.save", owner + " /" + prefix);
  return { ok: true };
}
__name(userSaveRoute, "userSaveRoute");
async function userDeleteRoute(env2, owner, prefix, source) {
  const p = normalizePrefix(prefix);
  if (!p) return { error: "\u7F3A\u5C11\u8DEF\u5F84\u53C2\u6570" };
  const user = await getUserByUsername(env2, owner);
  let changes = 0;
  if (source === "legacy" && user && await routesHasUserId(env2)) {
    const res = await env2.DB.prepare("DELETE FROM routes WHERE user_id = ? AND prefix = ?").bind(user.id, p).run();
    changes = Number(res.meta?.changes) || 0;
  } else {
    const res = await env2.DB.prepare("DELETE FROM user_routes WHERE owner = ? AND prefix = ?").bind(owner, p).run();
    changes = Number(res.meta?.changes) || 0;
    if (!changes && !source && user && await routesHasUserId(env2)) {
      const res2 = await env2.DB.prepare("DELETE FROM routes WHERE user_id = ? AND prefix = ?").bind(user.id, p).run();
      changes = Number(res2.meta?.changes) || 0;
    }
  }
  if (!changes) return { error: "\u8DEF\u7531\u4E0D\u5B58\u5728" };
  clearRouteCache();
  await auditLog(env2, "user.route.delete", owner + " /" + p);
  return { ok: true };
}
__name(userDeleteRoute, "userDeleteRoute");
function isValidIPv4(v) {
  const parts = String(v || "").split(".");
  if (parts.length !== 4) return false;
  return parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) >= 0 && Number(p) <= 255);
}
__name(isValidIPv4, "isValidIPv4");
function isValidDnsValue(v) {
  const s = String(v || "").trim().replace(/\.$/, "");
  if (!s || s.length > 253) return false;
  if (isValidIPv4(s)) return true;
  if (s.includes(":")) return /^[0-9a-f:]+$/i.test(s) && s.split(":").length <= 9;
  return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(s);
}
__name(isValidDnsValue, "isValidDnsValue");
async function provisionUserDns(env2, user) {
  try {
    const root = getUserDomain(env2) || getBaseDomain(env2);
    if (!root) return { ok: false, error: "\u672A\u914D\u7F6E BASE_DOMAIN / USER_DOMAIN" };
    const info3 = await resolveZoneInfo(env2, false, root);
    if (!info3.zoneId) return { ok: false, error: info3.error || "\u672A\u89E3\u6790\u5230 Cloudflare Zone\uFF0C\u8BF7\u68C0\u67E5 CF_API_TOKEN" };
    const entryHost = userEntryHost(env2, user);
    const target = DEFAULT_USER_DNS_TARGET;
    if (!isValidDnsValue(target)) return { ok: false, error: "\u9ED8\u8BA4 DNS \u76EE\u6807\u4E0D\u5408\u6CD5" };
    if (entryHost === target) return { ok: false, error: "DNS \u76EE\u6807\u4E0D\u80FD\u4E0E\u5165\u53E3\u57DF\u540D\u76F8\u540C" };
    const existing = await getDNSRecords(env2, info3.zoneId);
    if (existing.success && Array.isArray(existing.result)) {
      const same = existing.result.filter((r) => r.name === entryHost.toLowerCase() && ["A", "AAAA", "CNAME"].includes(r.type));
      const isOurs = same.length === 1 && same[0].type === "CNAME" && String(same[0].content).toLowerCase() === target.toLowerCase();
      if (same.length && !isOurs) {
        return { ok: false, error: "\u5B50\u57DF\u540D " + entryHost + " \u5DF2\u5B58\u5728 DNS \u8BB0\u5F55\uFF08" + same.map((r) => r.type + " " + r.content).join("\u3001") + "\uFF09\uFF0C\u672A\u81EA\u52A8\u8986\u76D6\uFF0C\u8BF7\u624B\u52A8\u5904\u7406" };
      }
    }
    const result = await createOrUpdateDNSRecord(
      env2,
      info3.zoneId,
      user.subdomain || user.username,
      target,
      root,
      { proxied: false, saveConfig: false }
    );
    if (!result.success) return { ok: false, error: result.error || result.errors?.[0]?.message || "DNS \u521B\u5EFA\u5931\u8D25" };
    await auditLog(env2, "user.dns", user.username + " -> " + entryHost + " = " + target + "\uFF08\u81EA\u52A8\uFF09");
    return { ok: true, entryHost, target, type: result.result?.type || "CNAME" };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}
__name(provisionUserDns, "provisionUserDns");
async function userUpdateDns(env2, session, target) {
  const user = await getUserById(env2, session.uid);
  if (!user) return { error: "\u7528\u6237\u4E0D\u5B58\u5728" };
  const value = String(target || "").trim().replace(/\.$/, "");
  if (!value) return { error: "\u8BF7\u8F93\u5165 IP \u6216\u57DF\u540D" };
  if (!isValidDnsValue(value)) return { error: "DNS \u503C\u5FC5\u987B\u662F\u5408\u6CD5\u7684 IPv4 / IPv6 \u5730\u5740\u6216\u57DF\u540D" };
  const root = getUserDomain(env2) || getBaseDomain(env2);
  if (!root) return { error: "\u672A\u914D\u7F6E BASE_DOMAIN / USER_DOMAIN" };
  const entryHost = userEntryHost(env2, user);
  if (value.toLowerCase() === entryHost.toLowerCase()) return { error: "DNS \u503C\u4E0D\u80FD\u6307\u5411\u5165\u53E3\u57DF\u540D\u81EA\u8EAB" };
  const info3 = await resolveZoneInfo(env2, false, root);
  if (!info3.zoneId) return { error: info3.error || "\u672A\u89E3\u6790\u5230 Cloudflare Zone\uFF0C\u8BF7\u68C0\u67E5 CF_API_TOKEN" };
  const result = await createOrUpdateDNSRecord(
    env2,
    info3.zoneId,
    user.subdomain || user.username,
    value,
    root,
    { proxied: false, saveConfig: false, forceRecreate: true }
  );
  if (!result.success) return { error: result.error || result.errors?.[0]?.message || "DNS \u66F4\u65B0\u5931\u8D25", errors: result.errors };
  await auditLog(env2, "user.dns", user.username + " -> " + entryHost + " = " + value);
  return { ok: true, entryHost, target: value, type: result.result?.type || detectRecordType(value), proxied: false, result: result.result };
}
__name(userUpdateDns, "userUpdateDns");
async function userEnsureDNS(env2, session) {
  const user = await getUserById(env2, session.uid);
  if (!user) return { error: "\u7528\u6237\u4E0D\u5B58\u5728" };
  const root = getUserDomain(env2) || getBaseDomain(env2);
  if (!root) return { error: "\u672A\u914D\u7F6E BASE_DOMAIN / USER_DOMAIN" };
  const entryHost = userEntryHost(env2, user);
  const current = await userDnsInfo(env2, session);
  let target = current && current.record && current.record.content ? current.record.content : DEFAULT_USER_DNS_TARGET;
  if (target === entryHost) target = root;
  if (target === entryHost) return { error: "\u5165\u53E3\u57DF\u540D\u4E0E\u76EE\u6807\u76F8\u540C\uFF0C\u65E0\u6CD5\u521B\u5EFA CNAME" };
  if (!isValidDnsValue(target)) return { error: "\u5F53\u524D DNS \u503C\u4E0D\u5408\u6CD5\uFF0C\u8BF7\u5148\u4FDD\u5B58\u65B0\u7684 IP \u6216\u57DF\u540D" };
  const info3 = await resolveZoneInfo(env2, false, root);
  if (!info3.zoneId) return { error: info3.error || "\u672A\u89E3\u6790\u5230 Cloudflare Zone\uFF0C\u8BF7\u68C0\u67E5 CF_API_TOKEN" };
  const result = await createOrUpdateDNSRecord(env2, info3.zoneId, user.subdomain || user.username, target, root, { proxied: false, saveConfig: false });
  if (!result.success) return { error: result.error || result.errors?.[0]?.message || "DNS \u521B\u5EFA\u5931\u8D25", errors: result.errors };
  await auditLog(env2, "user.dns", user.username + " -> " + entryHost);
  return { ok: true, entryHost, target, type: result.result?.type || "CNAME", proxied: false, result: result.result };
}
__name(userEnsureDNS, "userEnsureDNS");
async function userDnsInfo(env2, session) {
  const user = await getUserById(env2, session.uid);
  if (!user) return { error: "\u7528\u6237\u4E0D\u5B58\u5728" };
  const entryHost = userEntryHost(env2, user);
  const root = getUserDomain(env2) || getBaseDomain(env2);
  const info3 = await resolveZoneInfo(env2, false, root);
  let record = null;
  if (info3.zoneId) {
    try {
      const rr = await getDNSRecords(env2, info3.zoneId);
      if (rr.success && Array.isArray(rr.result)) {
        const rec = rr.result.find((r) => ["A", "AAAA", "CNAME"].includes(r.type) && r.name === entryHost);
        if (rec) record = { type: rec.type, name: rec.name, content: rec.content, proxied: rec.proxied, modifiedOn: rec.modified_on };
      }
    } catch (_) {
    }
  }
  return { ok: true, entryHost, baseDomain: getBaseDomain(env2), userDomain: getUserDomain(env2), statsHost: getStatsHost(env2), defaultTarget: DEFAULT_USER_DNS_TARGET, zoneId: info3.zoneId || "", zoneError: info3.error || "", record };
}
__name(userDnsInfo, "userDnsInfo");
async function handleUserApi(request, env2, url, session) {
  if (!session) return json({ error: "Unauthorized" }, 401);
  if (!env2.DB) return json({ error: "D1 \u6570\u636E\u5E93\u672A\u7ED1\u5B9A" }, 500);
  if (request.method !== "GET" && request.method !== "HEAD") {
    const origin = request.headers.get("Origin");
    if (origin && origin !== url.origin) return json({ error: "Forbidden origin" }, 403);
  }
  if (url.pathname === "/api/user/me" && request.method === "GET") {
    const user = session.uid === ADMIN_UID ? null : await getUserById(env2, session.uid);
    const entryHost = user ? userEntryHost(env2, user) : "";
    let routeCount = 0;
    if (user) routeCount = await countUserRoutes(env2, user);
    const userDomain = getUserDomain(env2) || getBaseDomain(env2);
    return json({
      ok: true,
      user: user ? publicUser(user) : { id: 0, username: "admin", role: "admin", subdomain: "", routeLimit: 999, status: "active" },
      baseDomain: getBaseDomain(env2),
      userDomain,
      mainHost: getStatsHost(env2),
      entryHost,
      entryUrl: entryHost ? "https://" + entryHost : "",
      routeCount,
      routeLimit: user ? user.routeLimit || DEFAULT_USER_ROUTE_LIMIT : 999,
      workerRouteHint: "\u9700\u8981\u5728 Cloudflare \u7ED9 Worker \u6DFB\u52A0\u8DEF\u7531 " + (userDomain ? "*." + userDomain + "/*" : "*/*") + "\uFF0C\u5B50\u57DF\u540D\u8BF7\u6C42\u624D\u4F1A\u8FDB\u5165 Worker"
    });
  }
  if (url.pathname === "/api/user/routes") {
    if (request.method === "GET") return json(await userListRoutes(env2, session.username));
    if (request.method === "POST") {
      const data = await readJson(request) || {};
      const out = await userSaveRoute(env2, session.username, data);
      return json(out, out.error ? 400 : 200);
    }
    if (request.method === "DELETE") {
      const out = await userDeleteRoute(env2, session.username, url.searchParams.get("prefix"), url.searchParams.get("source"));
      return json(out, out.error ? 404 : 200);
    }
  }
  if (url.pathname === "/api/user/routes/toggle" && request.method === "POST") {
    const data = await readJson(request) || {};
    const p = normalizePrefix(data.prefix);
    if (!p) return json({ error: "\u7F3A\u5C11 prefix" }, 400);
    const enabled = data.enabled ? 1 : 0;
    const user = await getUserByUsername(env2, session.username);
    if (!user) return json({ error: "\u7528\u6237\u4E0D\u5B58\u5728" }, 404);
    let changes = 0;
    if (data.source === "legacy" && await routesHasUserId(env2)) {
      const res = await env2.DB.prepare("UPDATE routes SET enabled = ? WHERE user_id = ? AND prefix = ?").bind(enabled, user.id, p).run();
      changes = Number(res.meta?.changes) || 0;
    } else {
      const res = await env2.DB.prepare("UPDATE user_routes SET enabled = ? WHERE owner = ? AND prefix = ?").bind(enabled, session.username, p).run();
      changes = Number(res.meta?.changes) || 0;
      if (!changes && !data.source && await routesHasUserId(env2)) {
        const res2 = await env2.DB.prepare("UPDATE routes SET enabled = ? WHERE user_id = ? AND prefix = ?").bind(enabled, user.id, p).run();
        changes = Number(res2.meta?.changes) || 0;
      }
    }
    if (!changes) return json({ error: "\u8DEF\u7531\u4E0D\u5B58\u5728" }, 404);
    clearRouteCache();
    return json({ success: true });
  }
  if (url.pathname === "/api/user/routes/reorder" && request.method === "POST") {
    const data = await readJson(request) || {};
    const order = Array.isArray(data.order) ? data.order.map(normalizePrefix).filter(Boolean) : [];
    if (!order.length) return json({ error: "\u7F3A\u5C11 order" }, 400);
    const user = await getUserByUsername(env2, session.username);
    const hasLegacy = user && await routesHasUserId(env2);
    const jobs = [];
    order.forEach((pf, i) => {
      jobs.push(env2.DB.prepare("UPDATE user_routes SET sort_order = ? WHERE owner = ? AND prefix = ?").bind(i, session.username, pf));
      if (hasLegacy) jobs.push(env2.DB.prepare("UPDATE routes SET sort_order = ? WHERE user_id = ? AND prefix = ?").bind(i, user.id, pf));
    });
    await env2.DB.batch(jobs);
    clearRouteCache();
    return json({ success: true });
  }
  if (url.pathname === "/api/user/routes/test" && request.method === "POST") {
    const data = await readJson(request) || {};
    const p = normalizePrefix(data.prefix);
    if (!p) return json({ error: "\u7F3A\u5C11 prefix" }, 400);
    let route = await env2.DB.prepare("SELECT target FROM user_routes WHERE owner = ? AND prefix = ?").bind(session.username, p).first();
    if (!route) {
      const user = await getUserByUsername(env2, session.username);
      if (user && await routesHasUserId(env2)) {
        route = await env2.DB.prepare("SELECT target FROM routes WHERE user_id = ? AND prefix = ? ORDER BY rowid LIMIT 1").bind(user.id, p).first();
      }
    }
    if (!route) return json({ error: "\u8DEF\u7531\u4E0D\u5B58\u5728" }, 404);
    const targets = splitTargets(route.target);
    const results = await Promise.all(targets.map(async (t) => ({ target: t, ...await probeTarget(t) })));
    return json({ success: true, results });
  }
  if (url.pathname === "/api/user/stats" && request.method === "GET") {
    return handleStatsRequest(env2, url, { owner: session.username });
  }
  if (url.pathname === "/api/user/dns") {
    if (request.method === "GET") {
      const out = await userDnsInfo(env2, session);
      return json(out, out.error ? 400 : 200);
    }
    if (request.method === "POST") {
      const data = await readJson(request) || {};
      const target = String(data.target || "").trim();
      const out = target ? await userUpdateDns(env2, session, target) : await userEnsureDNS(env2, session);
      return json(out, out.error ? 400 : 200);
    }
  }
  if (url.pathname === "/api/user/password" && request.method === "POST") {
    return changePassword(request, env2, session);
  }
  if (url.pathname === "/api/user/logout" && request.method === "POST") return logoutResponse();
  return json({ error: "Not found" }, 404);
}
__name(handleUserApi, "handleUserApi");
var routeCache = /* @__PURE__ */ new Map();
var ROUTE_CACHE_TTL = 3e4;
function clearRouteCache() {
  routeCache.clear();
}
__name(clearRouteCache, "clearRouteCache");
async function getRouteCached(env2, prefix, owner = "") {
  const now = Date.now();
  const cacheKey = (owner || "") + "|" + prefix;
  const hit = routeCache.get(cacheKey);
  if (hit && hit.exp > now) return hit.route;
  let route = null;
  if (owner) {
    route = await env2.DB.prepare("SELECT * FROM user_routes WHERE owner = ? AND prefix = ?").bind(owner, prefix).first();
    if (route) route = { ...route, owner };
    if (!route && await routesHasUserId(env2)) {
      const user = await getUserByUsername(env2, owner);
      if (user) {
        const legacy = await env2.DB.prepare(
          "SELECT * FROM routes WHERE user_id = ? AND prefix = ? ORDER BY rowid LIMIT 1"
        ).bind(user.id, prefix).first();
        if (legacy) route = { ...legacy, owner, legacyUserId: user.id };
      }
    }
  }
  if (!route) {
    if (await routesHasUserId(env2)) {
      route = await env2.DB.prepare(
        "SELECT * FROM routes WHERE prefix = ? AND (user_id IS NULL OR user_id = 0 OR user_id = '') ORDER BY rowid LIMIT 1"
      ).bind(prefix).first();
    } else {
      route = await env2.DB.prepare("SELECT * FROM routes WHERE prefix = ?").bind(prefix).first();
    }
  }
  if (routeCache.size > 1e3) routeCache.clear();
  routeCache.set(cacheKey, { route: route || null, exp: now + ROUTE_CACHE_TTL });
  return route || null;
}
__name(getRouteCached, "getRouteCached");
function normalizeRelayBase(v) {
  let u = String(v || "").trim();
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  return u.replace(/\/+$/, "");
}
__name(normalizeRelayBase, "normalizeRelayBase");
function getRelayCfg(settings) {
  if (!settings.relayEnabled || !settings.relayUrl || !settings.relaySecret) return null;
  const base = normalizeRelayBase(settings.relayUrl);
  return base && settings.relaySecret ? { base, secret: settings.relaySecret } : null;
}
__name(getRelayCfg, "getRelayCfg");
async function relayFetchHeaders(secret, targetUrl) {
  const ts = Date.now();
  const auth = await hmacHex(secret, ts + ":" + targetUrl);
  return { "X-Relay-Target": targetUrl, "X-Relay-Ts": String(ts), "X-Relay-Auth": auth };
}
__name(relayFetchHeaders, "relayFetchHeaders");
var fallbackLogAt = /* @__PURE__ */ new Map();
var FALLBACK_LOG_MS = 3e5;
function fallbackLogThrottled(key) {
  const now = Date.now();
  if (now - (fallbackLogAt.get(key) || 0) < FALLBACK_LOG_MS) return true;
  fallbackLogAt.set(key, now);
  return false;
}
__name(fallbackLogThrottled, "fallbackLogThrottled");
async function resolveProxyTarget(request, env2, url) {
  const rawSegments = url.pathname.split("/").filter(Boolean);
  let firstSeg = rawSegments[0] || "";
  try {
    firstSeg = decodeURIComponent(firstSeg);
  } catch {
    return { error: new Response("Bad Request", { status: 400 }) };
  }
  const prefix = normalizePrefix(firstSeg);
  if (!prefix) return { error: new Response("Not Found", { status: 404 }) };
  const routeOwner = await resolveOwnerFromHost(env2, url.hostname);
  const route = await getRouteCached(env2, prefix, routeOwner);
  if (!route) return { error: new Response("404: \u8282\u70B9\u4E0D\u5B58\u5728", { status: 404 }) };
  if (route.enabled === 0) return { error: new Response("503: \u8BE5\u8DEF\u7531\u5DF2\u505C\u7528", { status: 503 }) };
  const clientIp = request.headers.get("cf-connecting-ip") || "";
  const allow = parseIpList(route.ip_allow);
  const block = parseIpList(route.ip_block);
  if (block.length && ipMatches(clientIp, block)) return { error: new Response("Forbidden", { status: 403 }) };
  if (allow.length && !ipMatches(clientIp, allow)) return { error: new Response("Forbidden", { status: 403 }) };
  const enableCache = route.cache_img !== "off";
  const compatMode = route.compat_mode === "on";
  const rest = url.pathname.replace(/^\/[^/]*/, "");
  const targetUrls = splitTargets(route.target);
  const upstreamUrls = [];
  for (const target of targetUrls) {
    try {
      const t = new URL(target);
      const base = t.pathname.replace(/\/+$/, "");
      upstreamUrls.push(t.origin + base + rest + url.search);
    } catch {
      upstreamUrls.push(target.replace(/\/+$/, "") + rest + url.search);
    }
  }
  return {
    upstreamUrls,
    enableCache,
    compatMode,
    clientIpMode: normalizeIpMode(route.ip_mode),
    matchedPrefix: route.prefix,
    statPrefix: route.owner ? route.owner + "/" + route.prefix : route.prefix,
    routeOwner: route.owner || "",
    legacyUserId: route.legacyUserId || 0,
    customHeaders: parseHeaderLines(route.custom_headers).headers
  };
}
__name(resolveProxyTarget, "resolveProxyTarget");
var SENSITIVE_REQ_HEADERS = Object.freeze(["authorization", "cookie", "x-emby-token", "x-mediabrowser-token", "x-emby-authorization"]);
var hostDownUntil = /* @__PURE__ */ new Map();
var HOST_DOWN_MS = 3e4;
var lastPlayTouched = /* @__PURE__ */ new Map();
var LAST_PLAY_THROTTLE_MS = 6e4;
var API_TIMEOUT_MS = 15e3;
function buildUpstreamHeaders(request, upstreamUrl, { ipMode, compatMode, crossOrigin = false }) {
  const headers = new Headers(request.headers);
  for (const h of DROP_REQUEST_HEADERS) headers.delete(h);
  headers.delete("referer");
  if (crossOrigin) for (const h of SENSITIVE_REQ_HEADERS) headers.delete(h);
  headers.set("Host", upstreamUrl.host);
  if (ipMode === "forward") {
    const clientIp = request.headers.get("cf-connecting-ip");
    if (clientIp) {
      headers.set("x-forwarded-for", clientIp);
      headers.set("x-real-ip", clientIp);
    }
  } else if (ipMode === "disable") {
    stripClientIdentityHeaders(headers);
  }
  if (compatMode) {
    headers.set("Origin", upstreamUrl.origin);
    headers.set("X-Forwarded-Proto", upstreamUrl.protocol.replace(":", ""));
    headers.set("X-Forwarded-Host", upstreamUrl.host);
  }
  return headers;
}
__name(buildUpstreamHeaders, "buildUpstreamHeaders");
function progressKeyOf(request) {
  const u = new URL(request.url);
  const auth = request.headers.get("x-emby-authorization") || "";
  const dm = auth.match(/DeviceId="?([^",]+)/i);
  const device = u.searchParams.get("DeviceId") || request.headers.get("x-emby-device-id") || dm && dm[1] || "";
  const session = u.searchParams.get("PlaySessionId") || "";
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  return "progress:" + ip + ":" + device + ":" + session;
}
__name(progressKeyOf, "progressKeyOf");
async function proxyDirectUrl(request, env2, ctx, upstreamUrls, opts = {}) {
  const { enableCache = true, compatMode = false, clientIpMode = "forward", matchedPrefix = null, statPrefix = null, routeOwner = "", legacyUserId = 0, customHeaders = [] } = opts;
  const ipMode = normalizeIpMode(clientIpMode);
  const settings = await getSettings(env2);
  if (!upstreamUrls.length) return new Response("404: Target empty", { status: 404 });
  let firstUpstreamUrl;
  try {
    firstUpstreamUrl = new URL(upstreamUrls[0]);
  } catch {
    return new Response("Invalid upstream URL", { status: 500 });
  }
  const pathname = firstUpstreamUrl.pathname;
  const reqCategory = classifyRequest(pathname, request.method);
  const isPlaybackInfo = reqCategory === "playback_info";
  const isPlaying = reqCategory === "playing";
  const isPlayStart = isPlaying && /\/Sessions\/Playing\/?$/i.test(pathname);
  if (!["streaming", "segment", "image", "static"].includes(reqCategory) && rateLimited(request.headers.get("cf-connecting-ip") || "unknown", settings.rateLimitPerMin)) {
    return new Response("429: Too Many Requests", { status: 429, headers: { "Retry-After": "30" } });
  }
  if (/\/Sessions\/Playing\/Progress\/?$/i.test(pathname)) {
    const progressKey = progressKeyOf(request);
    const last = progressMap.get(progressKey) || 0;
    const now = Date.now();
    if (now - last < PROGRESS_THROTTLE_MS) {
      return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    }
    progressMap.set(progressKey, now);
    if (progressMap.size > PROGRESS_MAP_MAX) {
      const cutoff = now - 6e4;
      for (const [k, v] of progressMap) {
        if (v < cutoff) progressMap.delete(k);
        if (progressMap.size <= PROGRESS_MAP_MAX / 2) break;
      }
    }
  }
  const recordStats = /* @__PURE__ */ __name((bytes) => {
    if (!CONFIG.enableStats || !env2.DB) return;
    const nowTs = Date.now();
    if (matchedPrefix && (isPlaybackInfo || isPlaying || reqCategory === "streaming")) {
      const lastPlayKey = (routeOwner ? routeOwner + "/" : "") + matchedPrefix;
      const lt = lastPlayTouched.get(lastPlayKey) || 0;
      if (nowTs - lt > LAST_PLAY_THROTTLE_MS) {
        lastPlayTouched.set(lastPlayKey, nowTs);
        const nowTime = new Date(nowTs + 8 * 36e5).toISOString().replace("T", " ").split(".")[0];
        let lastPlaySql, lastPlayArgs;
        if (legacyUserId) {
          lastPlaySql = "UPDATE routes SET last_play = ? WHERE user_id = ? AND prefix = ?";
          lastPlayArgs = [nowTime, legacyUserId, matchedPrefix];
        } else if (routeOwner) {
          lastPlaySql = "UPDATE user_routes SET last_play = ? WHERE owner = ? AND prefix = ?";
          lastPlayArgs = [nowTime, routeOwner, matchedPrefix];
        } else {
          lastPlaySql = "UPDATE routes SET last_play = ? WHERE prefix = ?";
          lastPlayArgs = [nowTime, matchedPrefix];
        }
        ctx.waitUntil(
          env2.DB.prepare(lastPlaySql).bind(...lastPlayArgs).run().catch(() => {
          })
        );
      }
    }
  }, "recordStats");
  const meterBody = /* @__PURE__ */ __name((response) => {
    if (!response.body) {
      recordStats(0);
      return null;
    }
    recordStats(0);
    return response.body;
  }, "meterBody");
  const upgradeHeader = request.headers.get("Upgrade");
  if (upgradeHeader?.toLowerCase() === "websocket") {
    const relayWs = getRelayCfg(settings);
    const wsFetchRelay = /* @__PURE__ */ __name(async (target, wsHeaders2) => {
      const rUrl = new URL(target.pathname + target.search, relayWs.base);
      const h = new Headers(wsHeaders2);
      const signHeaders = await relayFetchHeaders(relayWs.secret, target.toString());
      for (const [k, v] of Object.entries(signHeaders)) h.set(k, v);
      return fetch(new Request(rUrl.toString(), { method: request.method, headers: h, redirect: "manual" }));
    }, "wsFetchRelay");
    if (ipMode === "forward") {
      try {
        return await fetch(upstreamUrls[0], request);
      } catch (err) {
        if (relayWs) {
          try {
            return await wsFetchRelay(new URL(upstreamUrls[0]), request.headers);
          } catch (_) {
          }
        }
        throw err;
      }
    }
    const wsHeaders = new Headers(request.headers);
    if (ipMode === "disable") {
      stripClientIdentityHeaders(wsHeaders);
    } else {
      wsHeaders.delete("x-real-ip");
      wsHeaders.delete("x-forwarded-for");
      wsHeaders.delete("forwarded");
    }
    try {
      return await fetch(upstreamUrls[0], new Request(upstreamUrls[0], { method: request.method, headers: wsHeaders }));
    } catch (err) {
      if (relayWs) {
        try {
          return await wsFetchRelay(new URL(upstreamUrls[0]), wsHeaders);
        } catch (_) {
        }
      }
      throw err;
    }
  }
  const hasAuthHeader = SENSITIVE_REQ_HEADERS.some((h) => request.headers.has(h));
  const canUseCache = enableCache && isCacheableRequest(reqCategory) && request.method === "GET" && !request.headers.has("Range") && !(reqCategory === "image" && hasAuthHeader);
  const cacheKey = canUseCache ? new Request(request.url, { method: "GET" }) : null;
  if (canUseCache) {
    try {
      const cachedResponse = await caches.default.match(cacheKey);
      if (cachedResponse) {
        const headers = new Headers(cachedResponse.headers);
        headers.set("X-Cache", "HIT");
        applySecurityHeaders(headers);
        recordStats(getResponseBytes(cachedResponse));
        return new Response(cachedResponse.body, { status: cachedResponse.status, statusText: cachedResponse.statusText, headers });
      }
    } catch (_) {
    }
  }
  let requestBody = null;
  if (request.method !== "GET" && request.method !== "HEAD") {
    requestBody = await request.arrayBuffer();
  }
  const timeoutSignal = /* @__PURE__ */ __name(() => (isPlaybackInfo || isPlaying || reqCategory === "api") && typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(API_TIMEOUT_MS) : void 0, "timeoutSignal");
  const relay = getRelayCfg(settings);
  const canRelayFallback = !!relay;
  let relayFallbackUsed = false;
  const tryRelayFallback = /* @__PURE__ */ __name(async (urlForRelay) => {
    if (!relay) return null;
    const t = urlForRelay instanceof URL ? urlForRelay : new URL(urlForRelay);
    const rUrl = new URL(t.pathname + t.search, relay.base);
    const fbHeaders = buildUpstreamHeaders(request, t, { ipMode, compatMode });
    for (const [k, v] of customHeaders) fbHeaders.set(k, v);
    const fbSign = await relayFetchHeaders(relay.secret, t.toString());
    for (const [k, v] of Object.entries(fbSign)) fbHeaders.set(k, v);
    const fbRange = request.headers.get("Range");
    if (fbRange) fbHeaders.set("Range", fbRange);
    const fbInit = { method: request.method, headers: fbHeaders, redirect: compatMode ? "follow" : "manual" };
    if (requestBody) fbInit.body = requestBody;
    return fetch(new Request(rUrl.toString(), fbInit));
  }, "tryRelayFallback");
  const relayResponseUsable = /* @__PURE__ */ __name((rb) => !!rb && !rb.headers.has("X-Relay-Denied") && ![401, 403, 451].includes(rb.status) && rb.status < 500, "relayResponseUsable");
  let finalResponse = null;
  let fallbackResponse = null;
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
    if (i < upstreamUrls.length - 1 && (hostDownUntil.get(upstreamUrl.host) || 0) > Date.now()) {
      lastError = lastError || new Error("\u7EBF\u8DEF\u6682\u65F6\u4E0D\u53EF\u7528: " + upstreamUrl.host);
      continue;
    }
    const colo = request.cf?.colo;
    if (colo && JP_COLOS.includes(colo)) {
      for (const suffix in settings.domainProxyRules) {
        if (upstreamUrl.host.endsWith(suffix)) {
          upstreamUrl.hostname = settings.domainProxyRules[suffix];
          break;
        }
      }
    }
    const headers = buildUpstreamHeaders(request, upstreamUrl, { ipMode, compatMode });
    for (const [k, v] of customHeaders) headers.set(k, v);
    const rangeHeader = request.headers.get("Range");
    if (rangeHeader && (reqCategory === "streaming" || reqCategory === "segment" || reqCategory === "other")) {
      if (!headers.has("Range")) headers.set("Range", rangeHeader);
      const ifRange = request.headers.get("If-Range");
      if (ifRange && !headers.has("If-Range")) headers.set("If-Range", ifRange);
    }
    const fetchInit = {
      method: request.method,
      headers,
      redirect: compatMode ? "follow" : "manual"
    };
    if (requestBody) fetchInit.body = requestBody;
    const sig = timeoutSignal();
    if (sig) fetchInit.signal = sig;
    try {
      let response = await fetch(new Request(upstreamUrl.toString(), fetchInit));
      if (canRelayFallback && ([401, 403, 451].includes(response.status) || CF_ORIGIN_ERROR_STATUSES.includes(response.status))) {
        if (!fallbackLogThrottled((matchedPrefix || "direct") + "|40x")) {
          try {
            await auditLog(env2, "relay.fallback", `${matchedPrefix || "direct"} ${request.method} ${pathname} direct_status=${response.status} colo=${request.cf?.colo || ""}`);
          } catch (_) {
          }
        }
        try {
          const rb = await tryRelayFallback(upstreamUrl);
          if (relayResponseUsable(rb)) {
            response = rb;
            relayFallbackUsed = true;
          }
        } catch (_) {
        }
      }
      if (!compatMode && UPSTREAM_FAILOVER_STATUSES.includes(response.status)) {
        lastError = new Error(`HTTP ${response.status}`);
        hostDownUntil.set(upstreamUrl.host, Date.now() + HOST_DOWN_MS);
        fallbackResponse = response;
        continue;
      }
      hostDownUntil.delete(upstreamUrl.host);
      finalResponse = response;
      lastUpstreamUrl = upstreamUrl;
      break;
    } catch (err) {
      lastError = err;
      if (canRelayFallback) {
        if (!fallbackLogThrottled((matchedPrefix || "direct") + "|err")) {
          try {
            await auditLog(env2, "relay.fallback.err", `${matchedPrefix || "direct"} ${request.method} ${pathname} direct_err=${err && err.message || String(err)} colo=${request.cf?.colo || ""}`);
          } catch (_) {
          }
        }
        try {
          const rb = await tryRelayFallback(upstreamUrl);
          if (relayResponseUsable(rb)) {
            hostDownUntil.delete(upstreamUrl.host);
            finalResponse = rb;
            lastUpstreamUrl = upstreamUrl;
            relayFallbackUsed = true;
            break;
          }
        } catch (_) {
        }
      }
      hostDownUntil.set(upstreamUrl.host, Date.now() + HOST_DOWN_MS);
      continue;
    }
  }
  if (!finalResponse && fallbackResponse) {
    finalResponse = fallbackResponse;
    lastUpstreamUrl = null;
  }
  if (!finalResponse) {
    return new Response("\u6240\u6709\u7EBF\u8DEF\u4E0D\u53EF\u7528: " + (lastError?.message || "Unknown"), { status: 502 });
  }
  if (!compatMode && lastUpstreamUrl) {
    const location = finalResponse.headers.get("Location");
    if (location && finalResponse.status >= 300 && finalResponse.status < 400) {
      let redirectUrl;
      try {
        redirectUrl = new URL(location, lastUpstreamUrl);
      } catch {
        return new Response("Bad redirect location", { status: 502 });
      }
      if (redirectUrl.protocol !== "http:" && redirectUrl.protocol !== "https:") {
        return new Response("Bad redirect location", { status: 502 });
      }
      if (MANUAL_REDIRECT_DOMAINS.concat(settings.manualDomains).some((domain2) => redirectUrl.hostname === domain2 || redirectUrl.hostname.endsWith("." + domain2))) {
        const newHeaders = sanitizeResponseHeaders(finalResponse.headers);
        newHeaders.set("Location", redirectUrl.toString());
        applySecurityHeaders(newHeaders);
        recordStats(0);
        return new Response(finalResponse.body, { status: finalResponse.status, headers: newHeaders });
      }
      if (isPrivateHost(redirectUrl.hostname)) {
        return new Response("Redirect target not allowed", { status: 502 });
      }
      const crossOrigin = redirectUrl.origin !== lastUpstreamUrl.origin;
      const newReqHeaders = buildUpstreamHeaders(request, redirectUrl, { ipMode, compatMode: false, crossOrigin });
      const redirectInit = { method: request.method, headers: newReqHeaders, body: requestBody || void 0, redirect: "follow" };
      const rsig = timeoutSignal();
      if (rsig) redirectInit.signal = rsig;
      try {
        finalResponse = await fetch(redirectUrl.toString(), redirectInit);
      } catch (err) {
        return new Response("\u91CD\u5B9A\u5411\u76EE\u6807\u4E0D\u53EF\u7528: " + (err?.message || "Unknown"), { status: 502 });
      }
    }
  }
  const responseHeaders = sanitizeResponseHeaders(finalResponse.headers);
  responseHeaders.set("Access-Control-Allow-Origin", "*");
  responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  responseHeaders.set("Access-Control-Allow-Headers", "*");
  applySecurityHeaders(responseHeaders);
  if (relayFallbackUsed) responseHeaders.set("X-Relay-Fallback", "1");
  if (isPlaying || isPlaybackInfo) {
    responseHeaders.set("X-Served-By", request.cf?.colo || "Unknown");
  }
  const body = meterBody(finalResponse);
  if (canUseCache && finalResponse.status === 200 && !finalResponse.headers.has("Set-Cookie")) {
    const maxAge = reqCategory === "image" ? 2592e3 : 86400;
    responseHeaders.set("Cache-Control", `public, max-age=${maxAge}`);
    responseHeaders.set("X-Cache", "MISS");
    const responseToCache = new Response(body, { status: finalResponse.status, statusText: finalResponse.statusText, headers: responseHeaders });
    ctx.waitUntil(caches.default.put(cacheKey, responseToCache.clone()).catch(() => {
    }));
    return responseToCache;
  }
  return new Response(body, {
    status: finalResponse.status,
    statusText: finalResponse.statusText,
    headers: responseHeaders
  });
}
__name(proxyDirectUrl, "proxyDirectUrl");
var SPEED_TOOLS = `
function pingOnce(url, timeout) {
  return new Promise(function(resolve) {
    var t0 = performance.now(), settled = false;
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function() { if (ctrl) ctrl.abort(); fin(-1); }, timeout);
    function fin(ms) { if (settled) return; settled = true; clearTimeout(timer); resolve(ms); }
    var bust = (url.indexOf('?') >= 0 ? '&' : '?') + '_=' + Date.now() + Math.random().toString(36).slice(2);
    fetch(url + bust, { mode: 'no-cors', cache: 'no-store', credentials: 'omit', signal: ctrl ? ctrl.signal : undefined })
      .then(function() { fin(Math.round(performance.now() - t0)); })
      .catch(function() { fin(-1); });
  });
}

// \u540C\u4E00\u57DF\u540D\u987A\u5E8F\u6D4B\u591A\u6B21\uFF08\u540E\u7EED\u8BF7\u6C42\u590D\u7528\u8FDE\u63A5\uFF0C\u53CD\u6620\u7A33\u5B9A\u5F80\u8FD4\u5EF6\u8FDF\uFF09\uFF0C\u53D6\u4E2D\u4F4D\u6570\uFF1B\u5931\u8D25\u8FC7\u534A\u89C6\u4E3A\u4E0D\u53EF\u7528
async function measureDomain(host, samples, timeout) {
  var times = [];
  for (var i = 0; i < samples; i++) {
    var ms = await pingOnce('https://' + host + '/cdn-cgi/trace', timeout);
    if (ms >= 0) times.push(ms);
  }
  if (times.length < Math.ceil(samples / 2)) return -1;
  times.sort(function(a, b) { return a - b; });
  return times[Math.floor(times.length / 2)];
}

async function runPool(items, limit, fn) {
  var out = new Array(items.length), idx = 0;
  async function w() { while (idx < items.length) { var i = idx++; out[i] = await fn(items[i]); } }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, w));
  return out;
}

function latencyLabel(ms) { return ms < 0 ? 'timeout' : ms < 100 ? 'fast' : ms < 300 ? 'good' : 'slow'; }

async function speedTestDomains(domains, onProgress) {
  var done = 0;
  var rows = await runPool(domains, 3, async function(d) {
    var ms = await measureDomain(d.domain, 4, 4000);
    done++;
    if (onProgress) onProgress(done, domains.length);
    return { id: d.id, domain: d.domain, name: d.name, host: d.domain, latency: ms, status: latencyLabel(ms), isBuiltin: d.isBuiltin };
  });
  rows.sort(function(a, b) { if (a.latency < 0) return 1; if (b.latency < 0) return -1; return a.latency - b.latency; });
  return rows;
}
`;
var PAGE_STYLE = `
  :root { --radius: 12px; --radius-s: 8px; }
  html[data-theme="dark"] {
    --bg: #06090f; --bg-grid: rgba(120,160,200,.045); --glow: rgba(56,209,255,.07);
    --surface: rgba(13,19,30,.74); --surface-2: rgba(20,28,42,.5);
    --line: rgba(148,163,184,.14); --line-strong: rgba(148,163,184,.3);
    --text: #dce5f0; --text-dim: #8494a8; --text-faint: #5a6b80;
    --accent: #41d9ff; --accent-dim: rgba(65,217,255,.12); --accent-line: rgba(65,217,255,.45);
    --accent-ink: #041018; --ok: #3ddc97; --ok-dim: rgba(61,220,151,.14);
    --warn: #ffc857; --warn-dim: rgba(255,200,87,.13);
    --bad: #ff6b6b; --bad-dim: rgba(255,107,107,.13);
    --info: #7ab8ff; --info-dim: rgba(122,184,255,.13);
    --shadow: 0 14px 44px rgba(0,0,0,.4); --input-bg: rgba(8,12,20,.62);
    --term-bar: rgba(15,22,34,.95);
  }
  html[data-theme="light"] {
    --bg: #f2f5f8; --bg-grid: rgba(30,60,90,.06); --glow: rgba(14,116,144,.06);
    --surface: rgba(255,255,255,.88); --surface-2: rgba(255,255,255,.65);
    --line: rgba(15,30,50,.1); --line-strong: rgba(15,30,50,.22);
    --text: #101826; --text-dim: #51617a; --text-faint: #8595ab;
    --accent: #087ea8; --accent-dim: rgba(8,126,168,.09); --accent-line: rgba(8,126,168,.45);
    --accent-ink: #ffffff; --ok: #0e9f6e; --ok-dim: rgba(14,159,110,.1);
    --warn: #b7791f; --warn-dim: rgba(183,121,31,.1);
    --bad: #dc2626; --bad-dim: rgba(220,38,38,.09);
    --info: #2563eb; --info-dim: rgba(37,99,235,.09);
    --shadow: 0 10px 30px rgba(20,40,70,.09); --input-bg: rgba(255,255,255,.85);
    --term-bar: #e7ecf2;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { -webkit-text-size-adjust: 100%; }
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--line-strong); border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--accent-line); }

  body {
    font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    line-height: 1.65; color: var(--text); background: var(--bg);
    min-height: 100vh; overflow-x: hidden;
    transition: background .3s ease, color .3s ease;
  }
  body::before {
    content: ''; position: fixed; inset: 0; z-index: 0; pointer-events: none;
    background-image:
      linear-gradient(var(--bg-grid) 1px, transparent 1px),
      linear-gradient(90deg, var(--bg-grid) 1px, transparent 1px);
    background-size: 44px 44px;
  }
  body::after {
    content: ''; position: fixed; inset: 0; z-index: 0; pointer-events: none;
    background: radial-gradient(ellipse 70% 45% at 50% -12%, var(--glow), transparent 70%);
  }

  .mono, code, .stat-val, .term, .lat span, .edge-item strong { font-family: ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, 'JetBrains Mono', monospace; }

  .container { max-width: 1160px; margin: auto; padding: 28px 22px 48px; display: flex; flex-direction: column; gap: 22px; position: relative; z-index: 1; }

  .topbar {
    position: sticky; top: 0; z-index: 50;
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 14px 22px; margin: -28px -22px 0;
    background: var(--surface); backdrop-filter: blur(16px) saturate(1.3); -webkit-backdrop-filter: blur(16px) saturate(1.3);
    border-bottom: 1px solid var(--line);
  }
  .brand { display: flex; align-items: center; gap: 10px; font-family: ui-monospace, 'SF Mono', Consolas, monospace; font-weight: 700; letter-spacing: .04em; font-size: 15px; color: var(--text); text-decoration: none; }
  .brand-mark { width: 9px; height: 9px; background: var(--accent); border-radius: 2px; box-shadow: 0 0 12px var(--accent-line); animation: pulse 2.6s ease-in-out infinite; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .45; } }
  .topbar-actions { display: flex; gap: 8px; align-items: center; }

  /* \u9876\u90E8\u5FEB\u6377\u5165\u53E3 */
  .linkbar { display: flex; flex-wrap: wrap; gap: 8px; margin-top: -6px; }
  .linkbar a {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 7px 13px; border-radius: 999px; font-size: 12px; font-weight: 600;
    border: 1px solid var(--line-strong); background: var(--surface); color: var(--text);
    text-decoration: none; transition: border-color .2s ease, color .2s ease, transform .2s ease;
  }
  .linkbar a:hover { border-color: var(--accent); color: var(--accent); transform: translateY(-1px); }

  .card {
    background: var(--surface); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
    border: 1px solid var(--line); border-radius: var(--radius);
    padding: 24px; position: relative;
    animation: rise .55s cubic-bezier(.22,1,.36,1) both;
    transition: border-color .25s ease, box-shadow .25s ease;
  }
  .container > .card:nth-child(2) { animation-delay: .06s; }
  .container > .card:nth-child(3) { animation-delay: .12s; }
  .container > .card:nth-child(4) { animation-delay: .18s; }
  .container > .card:nth-child(5) { animation-delay: .24s; }
  @keyframes rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
  .card:hover { border-color: var(--line-strong); }

  .sec-title {
    font-family: ui-monospace, 'SF Mono', Consolas, monospace;
    font-size: 12px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase;
    color: var(--text-dim); display: flex; align-items: center; gap: 8px; margin-bottom: 18px;
  }
  .sec-title::before { content: '//'; color: var(--accent); letter-spacing: 0; }
  .sec-title .chip { font-size: 10px; padding: 2px 8px; border-radius: 99px; background: var(--accent-dim); color: var(--accent); border: 1px solid var(--accent-line); letter-spacing: .08em; }

  .muted { color: var(--text-faint); font-size: 13px; }
  code {
    background: var(--accent-dim); color: var(--accent);
    padding: 3px 8px; border-radius: 5px; font-size: .85em;
    border: 1px solid var(--line); word-break: break-all;
  }

  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 7px;
    padding: 9px 18px; border-radius: var(--radius-s);
    background: transparent; border: 1px solid var(--line-strong); color: var(--text);
    font: 600 13.5px/1 -apple-system, system-ui, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    cursor: pointer; text-decoration: none; white-space: nowrap;
    transition: all .18s ease;
  }
  .btn:hover { border-color: var(--accent-line); color: var(--accent); box-shadow: 0 0 0 3px var(--accent-dim); }
  .btn:active { transform: translateY(1px); }
  .btn:disabled { opacity: .45; cursor: not-allowed; }
  .btn-solid { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
  .btn-solid:hover { color: var(--accent-ink); filter: brightness(1.1); box-shadow: 0 4px 18px var(--accent-dim); }
  .btn-danger { border-color: var(--bad-dim); color: var(--bad); background: var(--bad-dim); }
  .btn-danger:hover { border-color: var(--bad); color: var(--bad); box-shadow: 0 0 0 3px var(--bad-dim); }
  .btn-sm { padding: 6px 12px; font-size: 12.5px; }

  .theme-toggle {
    font-family: ui-monospace, 'SF Mono', Consolas, monospace;
    font-size: 11px; letter-spacing: .1em; padding: 7px 12px;
    background: transparent; border: 1px solid var(--line-strong); color: var(--text-dim);
    border-radius: 99px; cursor: pointer; transition: all .18s ease; min-width: 74px;
  }
  .theme-toggle:hover { color: var(--accent); border-color: var(--accent-line); }

  .hero { text-align: center; padding: 46px 24px 38px; }
  .hero-kicker { font-family: ui-monospace, 'SF Mono', Consolas, monospace; font-size: 11px; letter-spacing: .3em; text-transform: uppercase; color: var(--accent); margin-bottom: 14px; }
  .hero h1 { font-size: clamp(1.9rem, 5vw, 2.9rem); font-weight: 800; letter-spacing: -.02em; line-height: 1.15; margin-bottom: 12px; }
  .hero h1 em { font-style: normal; color: var(--accent); text-shadow: 0 0 30px var(--accent-line); }
  .hero p { color: var(--text-dim); font-size: 14.5px; max-width: 520px; margin: 0 auto; }
  .hero-actions { margin-top: 26px; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }

  .term { border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; text-align: left; margin-top: 28px; background: var(--surface-2); }
  .term-bar { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: var(--term-bar); border-bottom: 1px solid var(--line); }
  .term-bar i { width: 10px; height: 10px; border-radius: 50%; background: var(--line-strong); }
  .term-bar i:first-child { background: var(--bad); } .term-bar i:nth-child(2) { background: var(--warn); } .term-bar i:nth-child(3) { background: var(--ok); }
  .term-bar span { margin-left: 8px; font-size: 11px; color: var(--text-faint); letter-spacing: .08em; }
  .term-body { padding: 16px 18px; font-size: 13px; line-height: 2; }
  .term-body .p { color: var(--accent); margin-right: 10px; }
  .term-body .dim { color: var(--text-faint); }
  .term-body .hl { color: var(--accent); }

  .stat-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 14px; margin: 18px 0 6px; }
  .stat-card { border: 1px solid var(--line); border-radius: var(--radius-s); padding: 18px; background: var(--surface-2); position: relative; overflow: hidden; transition: border-color .2s ease; }
  .stat-card:hover { border-color: var(--accent-line); }
  .stat-card > div:first-child { color: var(--text-dim); font-size: 11px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; margin-bottom: 8px; }
  .stat-val { font-size: 1.9em; font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; letter-spacing: -.01em; }
  .stat-sub { color: var(--text-faint); font-size: 11px; margin-top: 6px; }

  table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13.5px; }
  th, td { padding: 12px 14px; text-align: left; }
  th { color: var(--text-faint); font-family: ui-monospace, 'SF Mono', Consolas, monospace; font-weight: 600; font-size: 10.5px; text-transform: uppercase; letter-spacing: .1em; border-bottom: 1px solid var(--line-strong); }
  td { border-bottom: 1px solid var(--line); }
  tbody tr:last-child td { border-bottom: none; }
  tbody tr { transition: background .15s ease; }
  tbody tr:hover { background: var(--accent-dim); }
  tr.best td { background: var(--ok-dim); }
  tr.best td:first-child { box-shadow: inset 3px 0 0 var(--ok); }

  /* \u5BA1\u8BA1\u65E5\u5FD7\uFF1A\u64CD\u4F5C\u5217\u4E0D\u6362\u884C/\u4E0D\u88C1\u5207\uFF0C\u8BE6\u60C5\u5217\u5141\u8BB8\u6362\u884C */
  #auditList td:nth-child(1) { white-space: nowrap; color: var(--text-faint); font-size: 12.5px; }
  #auditList td:nth-child(2) { white-space: nowrap; font-weight: 600; }
  #auditList td:nth-child(2) code { white-space: nowrap; }
  #auditList td:nth-child(3) { color: var(--text-dim); word-break: break-word; min-width: 220px; }
  #auditList th:nth-child(2) { white-space: nowrap; }

  .tag { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 5px; font-size: 11px; font-weight: 600; }
  .tag-fast { background: var(--ok-dim); color: var(--ok); }
  .tag-good { background: var(--info-dim); color: var(--info); }
  .tag-slow { background: var(--warn-dim); color: var(--warn); }
  .tag-timeout { background: var(--bad-dim); color: var(--bad); }
  .tag-builtin { background: var(--surface-2); color: var(--text-faint); border: 1px solid var(--line); }
  .tag-best { background: var(--ok-dim); color: var(--ok); border: 1px solid var(--ok); }

  .lat { display: flex; align-items: center; gap: 10px; min-width: 120px; }
  .lat-bar { flex: 1; height: 4px; border-radius: 99px; background: var(--line); overflow: hidden; max-width: 90px; }
  .lat-bar i { display: block; height: 100%; border-radius: 99px; background: linear-gradient(90deg, var(--accent), var(--info)); transition: width .5s cubic-bezier(.22,1,.36,1); }
  .lat span { font-size: 12px; color: var(--text-dim); font-variant-numeric: tabular-nums; white-space: nowrap; }

  .edge-box { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; }
  .edge-item { background: var(--surface-2); padding: 14px 16px; border-radius: var(--radius-s); font-size: 13px; border: 1px solid var(--line); transition: border-color .2s ease; }
  .edge-item:hover { border-color: var(--accent-line); }
  .edge-item strong { display: block; margin-bottom: 5px; font-size: 10px; text-transform: uppercase; letter-spacing: .1em; color: var(--accent); font-weight: 600; }
  .edge-item span:last-child { color: var(--text); font-weight: 500; word-break: break-all; }

  .chart { display: flex; align-items: flex-end; gap: 3px; height: 88px; padding: 10px 8px 6px; background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--radius-s); margin-top: 14px; }
  .chart-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 0; }
  .chart-col i { display: block; width: 100%; background: linear-gradient(180deg, var(--accent), var(--info)); border-radius: 3px 3px 0 0; min-height: 2px; transition: height .5s cubic-bezier(.22,1,.36,1); }
  .chart-col:hover i { background: var(--accent); }
  .chart-col b { font-size: 8px; color: var(--text-faint); font-weight: 500; font-family: ui-monospace, 'SF Mono', Consolas, monospace; }

  .warn { border: 1px solid var(--warn-dim); border-left: 3px solid var(--warn); padding: 13px 16px; border-radius: var(--radius-s); color: var(--warn); background: var(--warn-dim); font-size: 13px; }

  input:not([type=checkbox]):not([type=hidden]):not([type=radio]), select, textarea {
    width: 100%; padding: 11px 14px; border: 1px solid var(--line-strong); border-radius: var(--radius-s);
    background: var(--input-bg); color: var(--text); font-size: 14px; outline: none;
    transition: border-color .18s ease, box-shadow .18s ease;
  }
  textarea {
    display: block; min-height: 84px; padding: 10px 13px; font-size: 12.5px; line-height: 1.6;
    font-family: ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, monospace;
    white-space: pre-wrap; overflow-wrap: anywhere; resize: vertical;
  }
  input:focus, select:focus, textarea:focus { border-color: var(--accent-line); box-shadow: 0 0 0 3px var(--accent-dim); }
  input::placeholder, textarea::placeholder { color: var(--text-faint); }
  label { display: block; font-weight: 600; margin-bottom: 8px; font-size: 12.5px; color: var(--text-dim); }

  .toolbar { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }

  .dns-quick { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 10px 12px; margin-bottom: 8px; border: 1px solid var(--line); border-radius: var(--radius-s); background: var(--surface-2); }
  .dns-quick-tag { font-family: ui-monospace, 'SF Mono', Consolas, monospace; font-size: 10px; font-weight: 700; letter-spacing: .12em; color: var(--accent); border: 1px solid var(--accent-line); background: var(--accent-dim); border-radius: 4px; padding: 3px 8px; }
  .dns-quick input { flex: 1 1 160px; min-width: 120px; padding: 8px 12px; font-size: 13px; }
  .dns-quick-arrow { color: var(--text-faint); font-size: 13px; }
  @media (max-width: 768px) { .dns-quick input { flex: 1 1 100%; } }

  .route-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 14px; }
  .route-item { background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--radius-s); padding: 18px; transition: border-color .2s ease, transform .2s ease; }
  .route-item:hover { border-color: var(--accent-line); transform: translateY(-2px); }
  .route-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
  .route-title { flex: 1; min-width: 0; }
  .route-name { font-size: 1.05em; font-weight: 700; color: var(--text); margin: 0 0 3px; }
  .route-path { color: var(--accent); font-weight: 600; font-size: .85em; font-family: ui-monospace, 'SF Mono', Consolas, monospace; }
  .route-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; padding-top: 13px; border-top: 1px solid var(--line); }
  .target-list { margin-top: 8px; }
  .target-row { background: var(--input-bg); border: 1px solid var(--line); border-radius: 6px; padding: 9px 12px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  .target-row:hover { border-color: var(--line-strong); }
  .target-url { color: var(--text-dim); font-size: 12.5px; word-break: break-all; flex: 1; }
  .route-meta { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
  .meta-tag { font-size: 11px; padding: 3px 8px; background: var(--surface-2); border: 1px solid var(--line); border-radius: 5px; color: var(--text-dim); }

  .modal { display: none; position: fixed; inset: 0; background: rgba(2,6,12,.6); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); z-index: 1000; padding: 20px; overflow: auto; }
  .modal.show { display: flex; align-items: center; justify-content: center; animation: fadeIn .18s ease; }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .modal-inner { background: var(--surface); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); padding: 26px; border-radius: var(--radius); max-width: 520px; width: 100%; border: 1px solid var(--line-strong); box-shadow: var(--shadow); animation: slideUp .22s cubic-bezier(.22,1,.36,1); }
  @keyframes slideUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
  .modal-header { margin-bottom: 20px; }
  .modal-title { font-size: 1.15em; font-weight: 700; color: var(--text); margin: 0; }
  .modal-desc { color: var(--text-faint); font-size: 12.5px; margin: 6px 0 0; }
  .modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 22px; padding-top: 16px; border-top: 1px solid var(--line); }

  .search-box { position: relative; flex: 1; min-width: 200px; }
  .search-box input { margin-bottom: 0; padding-left: 12px; }

  .empty-state { text-align: center; padding: 36px 20px; color: var(--text-faint); }
  .empty-state-icon { font-size: 2.4em; margin-bottom: 10px; display: block; opacity: .5; }
  .empty-state-text { font-size: .95em; margin: 0; }

  .form-group { margin-bottom: 16px; }
  .form-hint { color: var(--text-faint); font-size: 12px; margin: 6px 0 0; }
  .form-hint span { color: var(--accent); font-weight: 600; }
  .checkbox-label { display: flex !important; align-items: center; gap: 10px !important; cursor: pointer; font-weight: 500 !important; }
  .checkbox-label input[type="checkbox"] { width: 16px !important; height: 16px; accent-color: var(--accent); cursor: pointer; flex-shrink: 0; }

  #toast {
    position: fixed; top: -70px; left: 50%; transform: translateX(-50%);
    background: var(--surface); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
    color: var(--text); padding: 12px 22px; border-radius: 14px; font-size: 13.5px; font-weight: 500; line-height: 1.5; text-align: left;
    transition: top .35s cubic-bezier(.22,1,.36,1); z-index: 9999;
    border: 1px solid var(--line-strong); box-shadow: var(--shadow); max-width: 90vw;
  }
  #toast.show { top: 20px; }

  .domain-list { margin-top: 12px; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .dns-current-config { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 13px 15px; background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--radius-s); margin-bottom: 16px; flex-wrap: wrap; }
  .dns-record-display { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; flex-wrap: wrap; }
  .dns-record-name { font-weight: 700; color: var(--accent); font-size: .95em; word-break: break-all; }
  .dns-record-arrow { color: var(--text-faint); font-size: 1.05em; }
  .dns-record-target { color: var(--text); font-weight: 600; font-size: .95em; word-break: break-all; }
  .dns-live-box { margin-top: 14px; padding: 13px 15px; background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--radius-s); }
  .dns-live-box .rec { font-size: 14px; color: var(--accent); font-weight: 600; word-break: break-all; }
  .dns-live-box .to { font-size: 13px; color: var(--text-dim); margin-top: 4px; word-break: break-all; }
  .dns-live-box .ts { font-size: 11px; color: var(--text-faint); margin-top: 4px; }
  .zone-chip { padding: 5px 12px; background: var(--surface-2); border: 1px solid var(--line); border-radius: 6px; font-size: 13px; }

  .login-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; position: relative; z-index: 1; }
  .login-box { background: var(--surface); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); padding: 38px 34px; border-radius: 16px; max-width: 380px; width: 100%; border: 1px solid var(--line-strong); box-shadow: var(--shadow); animation: rise .55s cubic-bezier(.22,1,.36,1) both; }
  .login-theme { position: absolute; top: 18px; right: 18px; }

  .spin { display: inline-block; width: 14px; height: 14px; border: 2px solid var(--line-strong); border-top-color: var(--accent); border-radius: 50%; animation: spin .7s linear infinite; vertical-align: -2px; margin-right: 8px; }
  @keyframes spin { to { transform: rotate(360deg); } }

  @media (max-width: 768px) {
    .container { padding: 16px 14px 40px; }
    .topbar { padding: 12px 16px; margin: -16px -14px 0; }
    .card { padding: 18px 16px; }
    .hero { padding: 32px 8px 28px; }
    .stat-row { grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .stat-card { padding: 14px; }
    .stat-val { font-size: 1.5em; }
    .route-grid { grid-template-columns: 1fr; }
    .edge-box { grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .modal { padding: 12px; }
    .modal-inner { padding: 20px 16px; }
    table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .search-box { min-width: 140px; }
    .brand span.bname { display: none; }
  }
  @media (max-width: 480px) {
    .stat-row { grid-template-columns: 1fr 1fr; }
    .edge-box { grid-template-columns: 1fr; }
    .hero-actions .btn { flex: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
  }
`;
var THEME_INIT = `
(function(){
  var pref='auto';
  try{ var s=localStorage.getItem('proxy-theme'); if(s==='dark'||s==='light'||s==='auto') pref=s; }catch(e){}
  function darkNow(){ return pref==='dark'||(pref==='auto'&&window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches); }
  document.documentElement.setAttribute('data-theme',darkNow()?'dark':'light');
  document.documentElement.setAttribute('data-theme-pref',pref);
})();
`;
var THEME_LOGIC = `
var THEME_PREF=document.documentElement.getAttribute('data-theme-pref')||'auto';
function applyTheme(pref){
  THEME_PREF=pref;
  var dark=pref==='dark'||(pref==='auto'&&window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme',dark?'dark':'light');
  document.documentElement.setAttribute('data-theme-pref',pref);
  var btn=document.getElementById('themeToggle');
  if(btn){ btn.textContent=pref==='auto'?'AUTO':(pref==='dark'?'DARK':'LIGHT'); btn.title=pref==='auto'?'\u8DDF\u968F\u7CFB\u7EDF':(pref==='dark'?'\u6DF1\u8272\u6A21\u5F0F':'\u6D45\u8272\u6A21\u5F0F'); }
  var meta=document.querySelector('meta[name=theme-color]');
  if(meta){ meta.setAttribute('content',dark?'#06090f':'#f2f5f8'); }
}
function cycleTheme(){
  var next=THEME_PREF==='auto'?'dark':(THEME_PREF==='dark'?'light':'auto');
  try{ localStorage.setItem('proxy-theme',next); }catch(e){}
  applyTheme(next);
}
if(window.matchMedia){
  try{
    var mq=matchMedia('(prefers-color-scheme: dark)');
    var onMq=function(){ if(THEME_PREF==='auto') applyTheme('auto'); };
    if(mq.addEventListener){ mq.addEventListener('change',onMq); } else if(mq.addListener){ mq.addListener(onMq); }
  }catch(e){}
}
applyTheme(THEME_PREF);
`;
function safeHttpUrl(v, fallback) {
  const s = String(v == null ? "" : v).trim();
  return /^https?:\/\//i.test(s) ? s : fallback;
}
__name(safeHttpUrl, "safeHttpUrl");
function renderTopLinks(env2) {
  const links = [
    { icon: "\u{1F4C8}", label: "\u4F18\u9009\u57DF\u540D\u76D1\u63A7", url: safeHttpUrl(envStr(env2, "MONITOR_URL"), "https://yx.255432.xyz/") },
    { icon: "\u{1F4AC}", label: "Telegram \u7FA4\u7EC4", url: safeHttpUrl(envStr(env2, "TG_GROUP_URL"), "https://t.me/+7cbXthaBajszNjI1") }
  ];
  return '<div class="linkbar">' + links.map(
    (l) => '<a href="' + l.url + '" target="_blank" rel="noopener">' + l.icon + " " + l.label + "</a>"
  ).join("") + "</div>";
}
__name(renderTopLinks, "renderTopLinks");
function buildFrontendHtml(env2) {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light"><meta name="theme-color" content="#06090f">
<title>Emby \u53CD\u5411\u4EE3\u7406</title><link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>\u{1F3AC}</text></svg>">
<script>${THEME_INIT}<\/script>
<style>${PAGE_STYLE}</style></head><body>
<div class="container">
  <div class="topbar">
    <a class="brand" href="/"><i class="brand-mark"></i><span class="bname">EMBY<span style="color:var(--accent)">\xB7</span>PROXY</span></a>
    <div class="topbar-actions">
      <button class="theme-toggle" id="themeToggle" onclick="cycleTheme()">AUTO</button>
      <a href="/admin" class="btn btn-sm">\u7BA1\u7406\u540E\u53F0</a>
    </div>
  </div>

  ${renderTopLinks(env2)}

  <div class="card hero">
    <div class="hero-kicker">REVERSE&nbsp;PROXY&nbsp;\xB7&nbsp;EDGE&nbsp;NETWORK</div>
    <h1>Emby <em>\u53CD\u5411\u4EE3\u7406</em></h1>
    <p>\u7248\u672C ${CURRENT_VERSION} \xB7 \u652F\u6301\u522B\u540D\u5FEB\u6377\u5165\u53E3\u4E0E\u4F18\u9009\u57DF\u540D\u81EA\u52A8\u6D4B\u901F \xB7 \u8FB9\u7F18\u8282\u70B9\u667A\u80FD\u52A0\u901F</p>
    <div class="term">
      <div class="term-bar"><i></i><i></i><i></i><span>~/emby-proxy \u2014 usage</span></div>
      <div class="term-body">
        <div><span class="p">$</span>https://<span class="hl">\u4F60\u7684\u57DF\u540D</span>/\u522B\u540D</div>
        <div><span class="p">$</span>https://<span class="hl">\u4F60\u7684\u57DF\u540D</span>/https://emby.example.com:8096</div>
        <div class="dim"># \u6DFB\u52A0\u670D\u52A1\u540E\u8BF7\u52A1\u5FC5\u624B\u52A8\u6D4B\u8BD5 \xB7 \u6076\u610F\u5237\u63A5\u53E3\u5C06\u5C01\u7981 IP</div>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="sec-title">\u5F53\u524D\u8FB9\u7F18\u8282\u70B9 <span class="chip">EDGE</span></div>
    <div id="edge-loading" class="muted"><span class="spin"></span>\u6B63\u5728\u63A2\u6D4B...</div>
    <div id="edge-info" class="edge-box" style="display:none"></div>
  </div>

  <div class="card">
    <div class="sec-title">\u4F18\u9009\u57DF\u540D\u6D4B\u901F <span class="chip">LATENCY</span></div>
    <div class="toolbar" style="margin-bottom:14px">
      <button class="btn btn-sm" id="btn-retest">\u91CD\u65B0\u6D4B\u901F</button>
      <span id="speed-status" class="muted"></span>
    </div>
    <div id="domain-table-wrap"><p class="muted"><span class="spin"></span>\u6B63\u5728\u6D4B\u901F...</p></div>
  </div>

  <div class="card">
    <div class="sec-title">\u4F7F\u7528\u7EDF\u8BA1 <span class="chip">CF&nbsp;ANALYTICS</span></div>
    <div id="stats-loading" class="muted"><span class="spin"></span>\u52A0\u8F7D\u4E2D...</div>
    <div id="stats-body" style="display:none">
      <div class="stat-row">
        <div class="stat-card"><div>\u4ECA\u65E5\u8BF7\u6C42</div><div class="stat-val" id="st-req">0</div><div class="stat-sub" id="st-req-sub"></div></div>
        <div class="stat-card"><div>\u4ECA\u65E5\u6D41\u91CF</div><div class="stat-val" id="st-traffic">0 B</div><div class="stat-sub" id="st-traffic-sub"></div></div>
        <div class="stat-card"><div>\u4ECA\u65E5\u8BBF\u95EE</div><div class="stat-val" id="st-uv">0</div><div class="stat-sub" id="st-uv-sub"></div></div>
      </div>
      <div id="hourly-chart"></div>
      <p class="muted" style="font-size:11px;margin-top:8px" id="st-updated"></p>
    </div>
  </div>
</div>
<script>${THEME_LOGIC}
var TAG = { fast:'\u6781\u5FEB', good:'\u826F\u597D', slow:'\u8F83\u6162', timeout:'\u8D85\u65F6' };
var CLS = { fast:'tag-fast', good:'tag-good', slow:'tag-slow', timeout:'tag-timeout' };

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
    ].map(function(kv){ return '<div class="edge-item"><strong>'+kv[0]+'</strong><span>'+(kv[1]||'\u2014')+'</span></div>'; }).join('');
  } catch(e) { document.getElementById('edge-loading').textContent = '\u52A0\u8F7D\u5931\u8D25'; }
}

function renderDomainTable(results, best) {
  const wrap = document.getElementById('domain-table-wrap');
  if (!results.length) { wrap.innerHTML = '<p class="muted">\u65E0\u6570\u636E</p>'; return; }
  let html = '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch"><table style="min-width:520px"><thead><tr><th>#</th><th>\u540D\u79F0</th><th>\u57DF\u540D</th><th>\u5EF6\u8FDF</th><th>\u72B6\u6001</th></tr></thead><tbody>';
  results.forEach((r, i) => {
    const host = r.host || r.domain;
    const isBest = best && best.domain === r.domain;
    const pct = r.latency >= 0 ? Math.max(5, Math.min(100, Math.round(r.latency / 3))) : 0;
    html += '<tr class="'+(isBest?'best':'')+'"><td class="mono" style="color:var(--text-faint)">'+(i+1)+'</td>'
      + '<td style="white-space:nowrap">'+ (r.name||'\u2014') + (isBest?' <span class="tag tag-best">BEST</span>':'') +'</td>'
      + '<td><code style="font-size:12px">'+host+'</code></td>'
      + '<td><div class="lat"><div class="lat-bar"><i style="width:'+pct+'%"></i></div><span>'+(r.latency>=0?r.latency+' ms':'\u2014')+'</span></div></td>'
      + '<td><span class="tag '+CLS[r.status||'timeout']+'">'+(TAG[r.status]||'\u2014')+'</span></td></tr>';
  });
  wrap.innerHTML = html + '</tbody></table></div>';
}

${SPEED_TOOLS}

function finalizeResults(rows) {
  rows.forEach(r => { if (r.latency >= 0) r.status = r.latency < 100 ? 'fast' : r.latency < 300 ? 'good' : 'slow'; else r.status = 'timeout'; });
  rows.sort((a,b) => { if (a.latency<0) return 1; if (b.latency<0) return -1; return a.latency-b.latency; });
  return rows;
}

async function getOptimizedDomains() {
  try {
    const r = await fetch('/api/domains/list');
    const d = await r.json();
    if (d.success) return d.domains;
  } catch (_) {}
  return [];
}

async function runDomainSpeed(force) {
  const st = document.getElementById('speed-status');
  const wrap = document.getElementById('domain-table-wrap');
  st.textContent = '\u6B63\u5728\u6D4B\u901F...';
  wrap.innerHTML = '<p class="muted"><span class="spin"></span>\u6B63\u5728\u6D4B\u8BD5\u60A8\u672C\u5730\u7F51\u7EDC\u5230\u5404\u4F18\u9009\u57DF\u540D\u7684\u5EF6\u8FDF...</p>';

  const domains = await getOptimizedDomains();
  const clientResults = await speedTestDomains(domains, function(d, n) { st.textContent = '\u6B63\u5728\u6D4B\u901F ' + d + '/' + n + '\uFF08\u5728\u60A8\u672C\u673A\u6D4F\u89C8\u5668\u4E2D\u8FDB\u884C\uFF0C\u6BCF\u4E2A\u57DF\u540D\u6D4B 4 \u6B21\u53D6\u4E2D\u4F4D\u6570\uFF09'; });
  finalizeResults(clientResults);
  const clientOk = clientResults.filter(r => r.latency >= 0).length;
  const best = clientResults.find(r => r.latency >= 0);
  renderDomainTable(clientResults, best);

  if (clientOk > 0) {
    st.textContent = '\u6D4B\u901F\u5B8C\u6210 \xB7 ' + clientOk + ' \u4E2A\u53EF\u7528 \xB7 \u63A8\u8350: ' + (best ? best.domain : '\u65E0');
  } else {
    st.textContent = '\u6D4B\u901F\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u6216\u7A0D\u540E\u91CD\u8BD5';
  }
}

async function loadStats() {
  try {
    const r = await fetch('/stats');
    const d = await r.json();
    if (d.error) { document.getElementById('stats-loading').textContent = d.error; return; }
    document.getElementById('stats-loading').style.display = 'none';
    document.getElementById('stats-body').style.display = 'block';
    document.getElementById('st-req').textContent = d.data.todayRequests ?? 0;
    document.getElementById('st-req-sub').textContent = '\u6765\u6E90: ' + (d.data.source || 'CF \u6570\u636E\u4E0D\u53EF\u7528');
    document.getElementById('st-traffic').textContent = d.data.todayTraffic || '0 B';
    document.getElementById('st-traffic-sub').textContent = '\u6765\u6E90: ' + (d.data.source || 'CF \u6570\u636E\u4E0D\u53EF\u7528') + ' \xB7 CF \u8FB9\u7F18\u51FA\u7AD9';
    document.getElementById('st-uv').textContent = d.data.todayVisits ?? 0;
    document.getElementById('st-uv-sub').textContent = '\u6765\u6E90: CF \u72EC\u7ACB\u8BBF\u95EE';
    const cfInfo = d.data.cfStatus || '';
    const envInfo = d.data.envInfo || {};
    document.getElementById('st-updated').textContent = '\u66F4\u65B0\u65F6\u95F4 ' + (d.data.lastUpdated||'') + ' \xB7 ' + cfInfo
      + (envInfo.statsHost ? ' \xB7 \u7EDF\u8BA1\u57DF\u540D ' + envInfo.statsHost : '')
      + (envInfo.zoneId ? ' \xB7 Zone ' + envInfo.zoneId.slice(0, 8) + '\u2026' : '')
      + (d.data.cfError ? ' (' + d.data.cfError + ')' : '');
    const hourly = d.data.hourlySeries || [];
    if (hourly.length) {
      const max = Math.max(1, ...hourly.map(h=>h.total));
      let hhtml = '<div class="chart">';
      hourly.forEach(h=>{
        const ht = Math.max(2, Math.round((h.total/max)*68));
        const label = h.label || '';
        hhtml += '<div class="chart-col" title="'+label+' \xB7 '+h.total+' \u6B21"><i style="height:'+ht+'px"></i><b>'+label.slice(0,2)+'</b></div>';
      });
      hhtml += '</div><p class="muted" style="font-size:11px;margin-top:6px">\u4ECA\u65E5 24 \u5C0F\u65F6\u8BF7\u6C42\u5206\u5E03\uFF08\u4E0A\u6D77\u65F6\u533A\uFF09</p>';
      document.getElementById('hourly-chart').innerHTML = hhtml;
    }
  } catch(e) { document.getElementById('stats-loading').textContent = '\u7EDF\u8BA1\u52A0\u8F7D\u5931\u8D25'; }
}

document.getElementById('btn-retest').onclick = () => runDomainSpeed(true);
loadEdge();
runDomainSpeed(false);
loadStats();
<\/script></body></html>`;
}
__name(buildFrontendHtml, "buildFrontendHtml");
function buildLoginHtml() {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light"><meta name="theme-color" content="#06090f">
<title>\u767B\u5F55</title><link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>\u{1F510}</text></svg>">
<script>${THEME_INIT}<\/script>
<style>${PAGE_STYLE}</style></head><body>
<div class="login-wrap">
  <div class="login-theme"><button class="theme-toggle" id="themeToggle" onclick="cycleTheme()">AUTO</button></div>
  <div class="login-box">
    <div style="text-align:center;margin-bottom:26px">
      <div class="hero-kicker" style="margin-bottom:10px">MULTI&nbsp;USER&nbsp;ACCESS</div>
      <h1 style="font-size:1.5em;font-weight:800;letter-spacing:-.01em">\u767B\u5F55</h1>
      <p class="muted" style="margin-top:8px">\u666E\u901A\u7528\u6237\u8F93\u5165\u7528\u6237\u540D + \u5BC6\u7801\uFF1B\u7BA1\u7406\u5458\u7528\u6237\u540D\u586B admin\uFF08\u6216\u7559\u7A7A\uFF09\u5E76\u4F7F\u7528\u7BA1\u7406\u5BC6\u94A5</p>
    </div>
    <form onsubmit="login();return false">
      <input id="usernameInput" placeholder="\u7528\u6237\u540D\uFF08\u7BA1\u7406\u5458\u586B admin \u6216\u7559\u7A7A\uFF09" autocomplete="username" autocapitalize="off" style="margin-bottom:10px">
      <input type="password" id="passwordInput" placeholder="\u5BC6\u7801 / \u7BA1\u7406\u5BC6\u94A5" autocomplete="current-password" style="margin-bottom:10px">
      <p id="loginErr" style="color:var(--bad);font-size:13px;min-height:1.4em;margin:6px 0;text-align:center"></p>
      <button class="btn btn-solid" style="width:100%;padding:12px" id="loginBtn" type="submit">\u767B \u5F55</button>
    </form>
    <p class="muted" style="text-align:center;margin-top:16px;font-size:13px">
      \u6CA1\u6709\u8D26\u53F7\uFF1F<a href="/register" style="color:var(--accent)">\u4F7F\u7528\u9080\u8BF7\u7801\u6CE8\u518C</a>
    </p>
  </div>
</div>
<script>${THEME_LOGIC}
async function login(){
  const u=document.getElementById('usernameInput').value.trim();
  const p=document.getElementById('passwordInput').value;
  const err=document.getElementById('loginErr');
  const btn=document.getElementById('loginBtn');
  err.textContent='';
  if(!p){ err.textContent='\u8BF7\u8F93\u5165\u5BC6\u7801 / \u7BA1\u7406\u5BC6\u94A5'; return; }
  btn.disabled=true; btn.textContent='\u9A8C\u8BC1\u4E2D...';
  const body = u ? {username:u,password:p} : {token:p};
  try{
    const r=await fetch('/admin/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const d=await r.json();
    if(d.ok){ location.href='/admin'; return; }
    err.textContent=d.error||'\u767B\u5F55\u5931\u8D25';
  } catch(e){ err.textContent='\u8BF7\u6C42\u5931\u8D25: '+e.message; }
  btn.disabled=false; btn.textContent='\u767B \u5F55';
}
<\/script></body></html>`;
}
__name(buildLoginHtml, "buildLoginHtml");
function buildRegisterHtml(env2) {
  const userDomain = (typeof getUserDomain === "function" ? getUserDomain(env2) : "") || "";
  const entryExample = userDomain ? "\u7528\u6237\u540D." + userDomain : "\u7528\u6237\u540D.\u6839\u57DF\u540D";
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light"><meta name="theme-color" content="#06090f">
<title>\u6CE8\u518C</title><link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>\u{1F3AB}</text></svg>">
<script>${THEME_INIT}<\/script>
<style>${PAGE_STYLE}</style></head><body>
<div class="login-wrap">
  <div class="login-theme"><button class="theme-toggle" id="themeToggle" onclick="cycleTheme()">AUTO</button></div>
  <div class="login-box">
    <div style="text-align:center;margin-bottom:22px">
      <div class="hero-kicker" style="margin-bottom:10px">INVITE&nbsp;ONLY</div>
      <h1 style="font-size:1.5em;font-weight:800;letter-spacing:-.01em">\u6CE8\u518C\u8D26\u53F7</h1>
      <p class="muted" style="margin-top:8px">\u6CE8\u518C\u540E\u81EA\u52A8\u83B7\u5F97\u72EC\u7ACB\u5B50\u57DF\u540D\uFF0C\u5E76\u81EA\u52A8\u521B\u5EFA <code>${entryExample}</code> \u7684 DNS \u8BB0\u5F55</p>
    </div>
    <form onsubmit="register();return false">
      <input id="regInvite" placeholder="\u9080\u8BF7\u7801" autocapitalize="characters" style="margin-bottom:10px">
      <input id="regUsername" placeholder="\u7528\u6237\u540D\uFF083-32 \u4F4D\u5C0F\u5199\u5B57\u6BCD/\u6570\u5B57/-\uFF09" autocomplete="username" autocapitalize="off" style="margin-bottom:10px">
      <p class="form-hint" style="margin:-4px 0 10px;text-align:left">\u7528\u6237\u540D\u540C\u65F6\u4F5C\u4E3A DNS \u524D\u7F00\uFF0C\u4E0D\u80FD\u4EE5 - \u5F00\u5934\u6216\u7ED3\u5C3E</p>
      <input type="password" id="regPassword" placeholder="\u5BC6\u7801\uFF08\u81F3\u5C11 6 \u4F4D\uFF09" autocomplete="new-password" style="margin-bottom:10px">
      <input type="password" id="regPassword2" placeholder="\u786E\u8BA4\u5BC6\u7801" autocomplete="new-password" style="margin-bottom:10px">
      <p id="regErr" style="color:var(--bad);font-size:13px;min-height:1.4em;margin:6px 0;text-align:center"></p>
      <button class="btn btn-solid" style="width:100%;padding:12px" id="regBtn" type="submit">\u6CE8 \u518C</button>
    </form>
    <p class="muted" style="text-align:center;margin-top:16px;font-size:13px">
      \u5DF2\u6709\u8D26\u53F7\uFF1F<a href="/admin" style="color:var(--accent)">\u8FD4\u56DE\u767B\u5F55</a>
    </p>
  </div>
</div>
<script>${THEME_LOGIC}
async function register(){
  const invite=document.getElementById('regInvite').value.trim();
  const username=document.getElementById('regUsername').value.trim();
  const password=document.getElementById('regPassword').value;
  const password2=document.getElementById('regPassword2').value;
  const err=document.getElementById('regErr');
  const btn=document.getElementById('regBtn');
  err.textContent='';
  if(!invite){ err.textContent='\u8BF7\u8F93\u5165\u9080\u8BF7\u7801'; return; }
  if(!username){ err.textContent='\u8BF7\u8F93\u5165\u7528\u6237\u540D'; return; }
  if(!/^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/.test(username.toLowerCase())){ err.textContent='\u7528\u6237\u540D\u9700\u4E3A 3-32 \u4F4D\u5C0F\u5199\u5B57\u6BCD\u3001\u6570\u5B57\u6216\u77ED\u6A2A\u7EBF\uFF0C\u4E14\u4E0D\u80FD\u4EE5 - \u5F00\u5934/\u7ED3\u5C3E'; return; }
  if(password.length<6){ err.textContent='\u5BC6\u7801\u81F3\u5C11 6 \u4F4D'; return; }
  if(password!==password2){ err.textContent='\u4E24\u6B21\u8F93\u5165\u7684\u5BC6\u7801\u4E0D\u4E00\u81F4'; return; }
  btn.disabled=true; btn.textContent='\u6CE8\u518C\u4E2D...';
  try{
    const r=await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({invite,username,password})});
    const d=await r.json();
    if(d.ok){
      if(d.dnsWarning){ alert('\u8D26\u53F7\u5DF2\u521B\u5EFA\uFF0C\u4F46 DNS \u8BB0\u5F55\u81EA\u52A8\u521B\u5EFA\u5931\u8D25\uFF1A' + d.dnsWarning + '\\n\\n\u767B\u5F55\u540E\u53EF\u5728\u300C\u6211\u7684\u5165\u53E3\u300D\u4E2D\u91CD\u8BD5\u3002'); }
      location.href='/admin'; return;
    }
    err.textContent=d.error||'\u6CE8\u518C\u5931\u8D25';
  } catch(e){ err.textContent='\u8BF7\u6C42\u5931\u8D25: '+e.message; }
  btn.disabled=false; btn.textContent='\u6CE8 \u518C';
}
<\/script></body></html>`;
}
__name(buildRegisterHtml, "buildRegisterHtml");
function buildAdminHtml(session, env2) {
  const isAdmin2 = Boolean(session && session.isAdmin);
  const username = String(session && session.username || "user").replace(/[^a-z0-9_-]/gi, "") || "user";
  const roleLabel = isAdmin2 ? "ADMIN" : "USER";
  const consoleName = isAdmin2 ? "ADMIN" : "USER";
  const effectiveMainHost = env2 ? getStatsHost(env2) || getBaseDomain(env2) || "" : "";
  const effectiveUserDomain = env2 ? getUserDomain(env2) || getBaseDomain(env2) || "" : "";
  const reportBtn = isAdmin2 ? '<button class="btn btn-sm" id="btnDailyReport" onclick="sendReport(this)">\u53D1\u9001\u65E5\u62A5</button>' : "";
  const settingsBtn = isAdmin2 ? '<button class="btn btn-sm" onclick="openSettings()">\u8BBE\u7F6E</button>' : "";
  const passwordBtn = isAdmin2 ? "" : '<button class="btn btn-sm" onclick="changePassword()">\u6539\u5BC6\u7801</button>';
  const routeToolbar = isAdmin2 ? `<button class="btn btn-sm btn-solid" onclick="openRouteModal()">\u6DFB\u52A0\u8DEF\u7531</button><button class="btn btn-sm" onclick="location.href='/admin/api/export'">\u5BFC\u51FA\u914D\u7F6E</button><button class="btn btn-sm" onclick="document.getElementById('importFile').click()">\u5BFC\u5165\u914D\u7F6E</button><input type="file" id="importFile" accept="application/json,.json" style="display:none" onchange="importConfig(this)">` : '<button class="btn btn-sm btn-solid" onclick="openRouteModal()">\u6DFB\u52A0\u8DEF\u7531</button><span class="muted" id="routeLimitHint"></span>';
  const dnsQuick = isAdmin2 ? `
    <div class="dns-quick">
      <span class="dns-quick-tag">DNS</span>
      <input id="dnsQuickName" placeholder="\u8BB0\u5F55\u540D\uFF08\u7559\u7A7A = BASE_DOMAIN\uFF09">
      <span class="dns-quick-arrow">\u2192</span>
      <input id="dnsQuickTarget" placeholder="\u76EE\u6807\u57DF\u540D\u6216 IP\uFF08\u53EF\u4EE5\u76F4\u63A5\u6539\uFF09">
      <button class="btn btn-sm btn-solid" id="dnsQuickSave" onclick="quickSaveDNS(this)">\u4FDD\u5B58</button>
      <button class="btn btn-sm" onclick="loadQuickDNS()">\u5237\u65B0</button>
    </div>
    <p class="muted" id="dnsQuickMeta" style="margin:-2px 0 14px;font-size:12px">DNS \u8BB0\u5F55\u52A0\u8F7D\u4E2D...</p>` : "";
  const statsCard = `
  <div class="card">
    <div class="sec-title">\u4F7F\u7528\u7EDF\u8BA1 <span class="chip" id="statsChip">CF</span></div>
    <div id="stats-loading" class="muted"><span class="spin"></span>\u52A0\u8F7D\u4E2D...</div>
    <div id="stats-body" style="display:none">
      <div class="stat-row">
        <div class="stat-card"><div>\u4ECA\u65E5\u8BF7\u6C42</div><div class="stat-val" id="st-req">0</div><div class="stat-sub" id="st-req-sub"></div></div>
        <div class="stat-card"><div>\u4ECA\u65E5\u6D41\u91CF</div><div class="stat-val" id="st-traffic">0 B</div><div class="stat-sub" id="st-traffic-sub"></div></div>
        <div class="stat-card"><div>\u4ECA\u65E5\u8BBF\u95EE</div><div class="stat-val" id="st-uv">0</div><div class="stat-sub" id="st-uv-sub"></div></div>
      </div>
      <div id="hourly-chart"></div>
      <p class="muted" style="font-size:11px;margin-top:8px" id="st-updated"></p>
    </div>
  </div>`;
  const userEntryCard = isAdmin2 ? "" : `
  <div class="card">
    <div class="sec-title">\u6211\u7684\u5165\u53E3 <span class="chip">ENTRY</span></div>
    <div class="edge-box">
      <div class="edge-item"><strong>\u7528\u6237\u540D</strong><span id="entryUser">${username}</span></div>
      <div class="edge-item"><strong>\u5165\u53E3\u57DF\u540D</strong><span id="entryHost">\u52A0\u8F7D\u4E2D...</span></div>
      <div class="edge-item"><strong>\u8DEF\u7531\u6570\u91CF</strong><span id="entryRoutes">\u2014</span></div>
      <div class="edge-item"><strong>DNS \u72B6\u6001</strong><span id="entryDns">\u52A0\u8F7D\u4E2D...</span></div>
    </div>
    <p class="muted" style="margin-top:12px;font-size:12px" id="entryHint"></p>
    <div class="form-group" style="margin-top:12px">
      <label>DNS \u8BB0\u5F55\u503C\uFF08CNAME \u76EE\u6807\uFF0C\u53EF\u586B IP \u6216\u57DF\u540D\uFF09</label>
      <div class="toolbar" style="flex-wrap:nowrap">
        <input id="entryDnsValue" placeholder="\u4F8B\u5982 youxuan.cf.090227.xyz \u6216 1.2.3.4" style="flex:1 1 auto;min-width:0">
        <button class="btn btn-sm btn-solid" style="flex:0 0 auto" onclick="saveUserDNS(this)">\u4FDD\u5B58 DNS \u503C</button>
      </div>
      <p class="form-hint">\u4FDD\u5B58\u65F6\u4F1A\u5148\u5220\u9664\u540C\u540D\u65E7\u8BB0\u5F55\u518D\u91CD\u65B0\u521B\u5EFA\uFF0C\u907F\u514D\u7C7B\u578B\u51B2\u7A81\uFF1B\u65B0\u8BB0\u5F55\u9ED8\u8BA4\u5173\u95ED\u5C0F\u9EC4\u4E91\u3002\u82E5\u72B6\u6001\u663E\u793A\u300C\u5DF2\u4EE3\u7406\u300D\uFF0C\u4FDD\u5B58\u4E00\u6B21\u5373\u53EF\u6539\u4E3A\u4EC5 DNS\u3002</p>
    </div>
    <div class="toolbar" style="margin-top:12px">
      <button class="btn btn-sm" onclick="ensureUserDNS(this)">\u91CD\u65B0\u521B\u5EFA DNS</button>
      <button class="btn btn-sm" onclick="loadUserEntry()">\u5237\u65B0</button>
      <a class="btn btn-sm" id="entryUrl" href="#" target="_blank" rel="noopener">\u6253\u5F00\u5165\u53E3</a>
    </div>
    <p class="muted" style="margin-top:10px;font-size:12px">\u8BBF\u95EE\u65B9\u5F0F\uFF1A<code>https://\u5165\u53E3\u57DF\u540D/\u8DEF\u7531\u524D\u7F00</code></p>
  </div>`;
  const adminCards = isAdmin2 ? `
  <div class="card">
    <div class="sec-title">\u7528\u6237\u7BA1\u7406 <span class="chip" id="userCount"></span></div>
    <div class="toolbar" style="margin-bottom:14px">
      <button class="btn btn-sm btn-solid" onclick="openUserModal()">\u6DFB\u52A0\u7528\u6237</button>
      <button class="btn btn-sm" onclick="loadUsers()">\u5237\u65B0</button>
    </div>
    <div id="userList" class="muted">\u52A0\u8F7D\u4E2D...</div>
  </div>

  <div class="card">
    <div class="sec-title">\u9080\u8BF7\u7801 <span class="chip">INVITE</span></div>
    <div class="toolbar" style="margin-bottom:14px">
      <button class="btn btn-sm btn-solid" onclick="openInviteModal()">\u751F\u6210\u9080\u8BF7\u7801</button>
      <button class="btn btn-sm btn-danger" onclick="clearInvites()">\u5220\u9664\u5168\u90E8\u9080\u8BF7\u7801</button>
      <button class="btn btn-sm" onclick="loadInvites()">\u5237\u65B0</button>
    </div>
    <div id="inviteList" class="muted">\u52A0\u8F7D\u4E2D...</div>
  </div>

  <div class="card">
    <div class="sec-title">\u4F18\u9009\u57DF\u540D\u7BA1\u7406 <span class="chip">CDN</span></div>
    <div class="toolbar" style="margin-bottom:16px">
      <button class="btn btn-sm" onclick="openDomainModal()">\u6DFB\u52A0\u57DF\u540D</button>
      <button class="btn btn-sm" onclick="testDomains()">\u624B\u52A8\u6D4B\u901F</button>
      <span id="domain-status" class="muted"></span>
    </div>
    <div id="domainList" class="domain-list"><p class="muted"><span class="spin"></span>\u52A0\u8F7D\u4E2D...</p></div>
  </div>

  <div class="card">
    <div class="sec-title">\u64CD\u4F5C\u65E5\u5FD7 <span class="chip">AUDIT</span></div>
    <div class="toolbar" style="margin-bottom:16px">
      <button class="btn btn-sm" onclick="loadAudit()">\u5237\u65B0</button>
      <button class="btn btn-sm btn-danger" onclick="resetStats()">\u6E05\u7A7A\u7EDF\u8BA1</button>
    </div>
    <div id="auditList" class="muted">\u70B9\u51FB\u5237\u65B0\u67E5\u770B\u6700\u8FD1 100 \u6761\u64CD\u4F5C</div>
  </div>` : "";
  const adminModals = isAdmin2 ? `
<div id="modalDomain" class="modal">
  <div class="modal-inner">
    <div class="modal-header">
      <h2 class="modal-title" id="domainModalTitle">\u6DFB\u52A0\u4F18\u9009\u57DF\u540D</h2>
      <p class="modal-desc">\u6DFB\u52A0\u60A8\u81EA\u5DF1\u7684\u4F18\u9009\u57DF\u540D</p>
    </div>
    <input type="hidden" id="domainId">
    <div class="form-group">
      <label>\u540D\u79F0</label>
      <input id="domainName" placeholder="\u4F8B\u5982\uFF1A\u6211\u7684\u4F18\u9009\u57DF\u540D">
    </div>
    <div class="form-group">
      <label>\u57DF\u540D</label>
      <input id="domainUrl" type="url" placeholder="https://example.com">
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal('modalDomain')">\u53D6\u6D88</button>
      <button class="btn btn-solid" onclick="saveDomain()">\u4FDD\u5B58</button>
    </div>
  </div>
</div>

<div id="modalSettings" class="modal">
  <div class="modal-inner">
    <div class="modal-header">
      <h2 class="modal-title">\u7CFB\u7EDF\u8BBE\u7F6E</h2>
      <p class="modal-desc">\u5B9A\u65F6\u4EFB\u52A1\u9700\u8981\u5728 Cloudflare \u63A7\u5236\u53F0\u4E3A Worker \u6DFB\u52A0 Cron \u89E6\u53D1\u5668\uFF08\u5982 */10 * * * *\uFF09</p>
    </div>
    <div class="form-group">
      <label class="checkbox-label"><input type="checkbox" id="setHealth"> \u542F\u7528\u7EBF\u8DEF\u5065\u5EB7\u68C0\u67E5\uFF08\u8FDE\u7EED 2 \u6B21\u5931\u8D25\u544A\u8B66\uFF0C\u6062\u590D\u65F6\u518D\u901A\u77E5\uFF09</label>
      <p class="form-hint" id="notifyHint"></p>
    </div>
    <div class="form-group">
      <label class="checkbox-label"><input type="checkbox" id="setDailyReport" checked> \u6BCF\u5929 23:00\uFF08\u5317\u4EAC\u65F6\u95F4\uFF09\u81EA\u52A8\u53D1\u9001 Telegram \u65E5\u62A5</label>
      <p class="form-hint">\u9700\u8981\u7ED9 Worker \u914D\u7F6E Cron \u89E6\u53D1\u5668\uFF0C\u4F8B\u5982 <code>0 15 * * *</code>\uFF1B\u4E5F\u53EF\u4EE5\u968F\u65F6\u70B9\u9876\u90E8\u7684\u300C\u53D1\u9001\u65E5\u62A5\u300D\u624B\u52A8\u53D1\u9001</p>
    </div>
    <div class="form-group">
      <label>\u6BCF IP \u6BCF\u5206\u949F\u8BF7\u6C42\u4E0A\u9650\uFF080 = \u4E0D\u9650\u5236\uFF09</label>
      <input id="setRate" type="number" min="0" placeholder="0">
      <p class="form-hint">\u4EC5\u9650\u5236 API \u7C7B\u8BF7\u6C42\uFF0C\u4E0D\u5F71\u54CD\u56FE\u7247\u548C\u89C6\u9891\u6D41</p>
    </div>
    <div class="form-group">
      <label>\u989D\u5916\u7684\u624B\u52A8\u91CD\u5B9A\u5411\u57DF\u540D\uFF08\u9017\u53F7\u5206\u9694\uFF09</label>
      <input id="setManual" placeholder="\u4F8B\u5982 example-cdn.com, other.net">
      <label style="margin-top:12px">\u57DF\u540D\u6620\u5C04\u89C4\u5219\uFF08JSON\uFF0C\u65E5\u672C\u673A\u623F\u4F7F\u7528\uFF09</label>
      <textarea id="setRules" rows="2" placeholder='{"example.com":"1.2.3.4"}'></textarea>
    </div>
    <div class="form-group">
      <label>\u591A\u4EBA\u7248\u8BF4\u660E</label>
      <p class="form-hint">\u7528\u6237\u901A\u8FC7 <code>\u7528\u6237\u540D.\u7528\u6237\u57DF\u540D</code> \u8BBF\u95EE\u81EA\u5DF1\u7684\u8DEF\u7531\uFF1B\u9700\u8981\u5728 Cloudflare \u7ED9 Worker \u6DFB\u52A0\u8DEF\u7531 <code>*.${effectiveUserDomain || "\u7528\u6237\u57DF\u540D"}/*</code>\uFF08\u6216 <code>*/*</code>\uFF09\u3002</p>
      <p class="form-hint">\u5F53\u524D Worker \u5165\u53E3\uFF1A<code>${effectiveMainHost || "\u672A\u914D\u7F6E"}</code>\uFF1B\u7528\u6237\u57DF\u540D\uFF1A<code>${effectiveUserDomain || "\u672A\u914D\u7F6E"}</code></p>
      <p class="form-hint">\u7528\u6237\u57DF\u540D\u81EA\u52A8\u4ECE\u73B0\u6709\u53D8\u91CF\u63A8\u5BFC\uFF0C\u4E0D\u7ED1\u5B9A\u4EFB\u4F55\u56FA\u5B9A\u57DF\u540D\uFF1A\u9ED8\u8BA4 = <code>BASE_DOMAIN</code>\uFF1B\u5982\u679C <code>BASE_DOMAIN</code> \u672C\u8EAB\u5C31\u662F Worker \u5165\u53E3\uFF08\u5F62\u5982 <code>\u5B50\u57DF\u540D.example.com</code>\uFF09\u4E14 <code>DNS_RECORD_NAME</code> \u4E0E\u90A3\u4E00\u7EA7\u76F8\u540C\uFF0C\u4F1A\u81EA\u52A8\u53BB\u6389\u5B83\uFF0C\u5F97\u5230 <code>example.com</code>\uFF0C\u7528\u6237\u5165\u53E3\u5C31\u662F <code>\u7528\u6237\u540D.example.com</code>\u3002\u9700\u8981\u65F6\u4E5F\u53EF\u7528 <code>USER_DOMAIN</code> \u663E\u5F0F\u6307\u5B9A\u4EFB\u610F\u57DF\u540D\u3002</p>
    </div>
    <div class="form-group" style="border-top:1px solid var(--border);padding-top:14px">
      <label>VPS \u4E2D\u7EE7\uFF08CF \u76F4\u8FDE\u5931\u8D25\u65F6\u81EA\u52A8\u5207\u6362\uFF0C\u8054\u901A\u540E\u6240\u6709\u8DEF\u7531\u81EA\u52A8\u542F\u7528\uFF09</label>
      <input id="setRelayUrl" placeholder="https://relay.example.com:2087" autocapitalize="off">
      <input id="setRelaySecret" type="password" placeholder="\u7559\u7A7A\u8868\u793A\u4E0D\u4FEE\u6539\u5BC6\u94A5" autocomplete="new-password" style="margin-top:8px">
      <label class="checkbox-label" style="margin-top:8px"><input type="checkbox" id="setRelayEnabled"> \u542F\u7528\u4E2D\u7EE7\uFF08\u9ED8\u8BA4\u52FE\u9009\uFF1B\u70B9\u300C\u6D4B\u8BD5\u300D\u8054\u901A\u540E\u81EA\u52A8\u5F00\u542F\uFF09</label>
      <div style="margin-top:8px;display:flex;gap:8px;align-items:center">
        <button class="btn btn-sm" onclick="testRelay()">\u6D4B\u8BD5\u8FDE\u901A</button>
        <span class="form-hint" id="relayTestResult" style="margin:0"></span>
      </div>
      <div id="relayUsage" class="muted" style="margin-top:10px;font-size:12px;line-height:1.7">VPS \u7EDF\u8BA1\u52A0\u8F7D\u4E2D...</div>
      <p class="form-hint">\u4E2D\u7EE7\u884C\u4E3A\uFF1A\u76F4\u8FDE\u4F18\u5148\uFF0C\u76F4\u8FDE\u5931\u8D25\uFF08\u7F51\u7EDC\u9519\u8BEF/401/403/451\uFF09\u624D\u81EA\u52A8\u8D70 VPS\uFF1BVPS \u6D41\u91CF\u9650\u989D\u8D85\u9650\u65F6\u81EA\u52A8\u56DE\u843D\u76F4\u8FDE\uFF0C\u7528\u6237\u65E0\u611F\u3002\u8986\u76D6\u6240\u6709\u7528\u6237\u8DEF\u7531\u548C <code>/https://\u6E90\u7AD9:\u7AEF\u53E3</code> \u76F4\u8FDE\u4EE3\u7406\u8DEF\u5F84\u3002</p>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="runNow()">\u7ACB\u5373\u5065\u5EB7\u68C0\u67E5</button>
      <button class="btn" onclick="closeModal('modalSettings')">\u53D6\u6D88</button>
      <button class="btn btn-solid" onclick="saveSettings()">\u4FDD\u5B58</button>
    </div>
  </div>
</div>

<div id="modalUser" class="modal">
  <div class="modal-inner">
    <div class="modal-header">
      <h2 class="modal-title" id="userModalTitle">\u6DFB\u52A0\u7528\u6237</h2>
      <p class="modal-desc">\u7528\u6237\u5C06\u62E5\u6709\u72EC\u7ACB\u7684\u5B50\u57DF\u540D\u548C\u8DEF\u7531\u7A7A\u95F4</p>
    </div>
    <input type="hidden" id="userId">
    <div class="form-group">
      <label>\u7528\u6237\u540D</label>
      <input id="userUsername" placeholder="3-32 \u4F4D\u5C0F\u5199\u5B57\u6BCD/\u6570\u5B57/-\uFF08\u540C\u65F6\u4F5C\u4E3A DNS \u8BB0\u5F55\u540D\uFF09" autocapitalize="off">
    </div>
    <div class="form-group">
      <label>\u5BC6\u7801</label>
      <input id="userPassword" type="password" placeholder="\u7F16\u8F91\u65F6\u7559\u7A7A\u8868\u793A\u4E0D\u4FEE\u6539" autocomplete="new-password">
    </div>
    <div class="form-group">
      <label>\u5B50\u57DF\u540D</label>
      <input id="userSubdomain" placeholder="\u4F8B\u5982 alice\uFF08\u7559\u7A7A = \u7528\u6237\u540D\uFF09" autocapitalize="off">
      <p class="form-hint">\u6700\u7EC8\u5165\u53E3\uFF1A<code>\u5B50\u57DF\u540D.\u7528\u6237\u57DF\u540D</code>\uFF1B\u521B\u5EFA\u7528\u6237\u65F6\u4F1A\u81EA\u52A8\u5EFA CNAME\uFF08\u5C0F\u9EC4\u4E91\u5173\u95ED\uFF09\uFF0C\u7528\u6237\u53EF\u5728\u300C\u6211\u7684\u5165\u53E3\u300D\u91CC\u4FEE\u6539\u8BB0\u5F55\u503C</p>
    </div>
    <div class="form-group">
      <label>\u89D2\u8272</label>
      <select id="userRole">
        <option value="user">\u666E\u901A\u7528\u6237</option>
        <option value="admin">\u7BA1\u7406\u5458</option>
      </select>
    </div>
    <div class="form-group">
      <label>\u72B6\u6001</label>
      <select id="userStatus">
        <option value="active">\u6B63\u5E38</option>
        <option value="disabled">\u7981\u7528</option>
      </select>
    </div>
    <div class="form-group">
      <label>\u8DEF\u7531\u6570\u91CF\u4E0A\u9650</label>
      <input id="userRouteLimit" type="number" min="1" max="200" value="20">
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal('modalUser')">\u53D6\u6D88</button>
      <button class="btn btn-solid" onclick="saveUser()">\u4FDD\u5B58</button>
    </div>
  </div>
</div>

<div id="modalInvite" class="modal">
  <div class="modal-inner">
    <div class="modal-header">
      <h2 class="modal-title">\u751F\u6210\u9080\u8BF7\u7801</h2>
      <p class="modal-desc">\u9080\u8BF7\u7801\u7528\u4E8E\u6CE8\u518C\u65B0\u7528\u6237</p>
    </div>
    <div class="form-group">
      <label>\u9080\u8BF7\u7801\uFF08\u7559\u7A7A\u81EA\u52A8\u751F\u6210\uFF09</label>
      <input id="inviteCode" placeholder="\u4F8B\u5982 WELCOME2026" autocapitalize="characters">
    </div>
    <div class="form-group">
      <label>\u6700\u5927\u4F7F\u7528\u6B21\u6570\uFF080 = \u4E0D\u9650\uFF09</label>
      <input id="inviteMaxUses" type="number" min="0" value="1">
    </div>
    <div class="form-group">
      <label>\u8FC7\u671F\u65E5\u671F\uFF08\u53EF\u9009\uFF09</label>
      <input id="inviteExpires" type="date">
    </div>
    <div class="form-group">
      <label>\u5907\u6CE8</label>
      <input id="inviteNote" placeholder="\u4F8B\u5982\uFF1A\u7ED9\u670B\u53CB">
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal('modalInvite')">\u53D6\u6D88</button>
      <button class="btn btn-solid" onclick="saveInvite()">\u751F\u6210</button>
    </div>
  </div>
</div>` : "";
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light"><meta name="theme-color" content="#06090f">
<title>${consoleName} \u63A7\u5236\u53F0</title><link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>\u{1F39B}\uFE0F</text></svg>">
<script>${THEME_INIT}<\/script>
<style>${PAGE_STYLE}</style></head><body>
<div id="toast"></div>
<div class="container">
  <div class="topbar">
    <a class="brand" href="/"><i class="brand-mark"></i><span class="bname">${consoleName}<span style="color:var(--accent)">\xB7</span>CONSOLE</span></a>
    <div class="topbar-actions">
      <button class="theme-toggle" id="themeToggle" onclick="cycleTheme()">AUTO</button>
      <span class="meta-tag" title="${roleLabel}">${roleLabel} \xB7 ${username}</span>
      ${reportBtn}
      ${passwordBtn}
      <a href="/" class="btn btn-sm">\u9996\u9875</a>
      ${settingsBtn}
      <button class="btn btn-sm btn-danger" onclick="logout()">\u9000\u51FA</button>
    </div>
  </div>

  ${renderTopLinks(env2)}

  <div class="card">
    <div class="sec-title">${isAdmin2 ? "\u6211\u6DFB\u52A0\u7684\u5168\u5C40\u8DEF\u7531" : "\u6211\u7684\u8DEF\u7531"} <span class="chip" id="routeCount"></span></div>
    <div class="toolbar" style="margin-bottom:16px">
      ${routeToolbar}
      <div class="search-box">
        <input type="text" id="routeSearch" placeholder="\u641C\u7D22\u5907\u6CE8\u6216\u8DEF\u5F84..." oninput="filterRoutes()">
      </div>
    </div>
    ${isAdmin2 ? '<p class="muted" style="margin:-6px 0 14px">\u53EA\u80FD\u770B\u5230\u4F60\u81EA\u5DF1\u6DFB\u52A0\u7684\u8DEF\u7531\uFF1B\u5176\u4ED6\u7BA1\u7406\u5458\u548C\u7528\u6237\u7684\u8DEF\u7531\u4E0D\u4F1A\u663E\u793A\uFF08\u7528\u6237\u8DEF\u7531\u4ECD\u6B63\u5E38\u4EE3\u7406\uFF09\u3002</p>' : ""}
    ${dnsQuick}
    <div id="routeList" class="route-grid"><p class="muted"><span class="spin"></span>\u52A0\u8F7D\u4E2D...</p></div>
  </div>

  ${userEntryCard}
  ${statsCard}
  ${adminCards}
</div>

<div id="modalRoute" class="modal">
  <div class="modal-inner">
    <div class="modal-header">
      <h2 class="modal-title" id="routeModalTitle">\u6DFB\u52A0\u8DEF\u7531</h2>
      <p class="modal-desc">\u521B\u5EFA\u8DEF\u7531\u540E\u53EF\u901A\u8FC7 /\u8DEF\u5F84 \u5FEB\u6377\u8BBF\u95EE\u76EE\u6807\u670D\u52A1</p>
    </div>
    <input type="hidden" id="oldPrefix">
    <input type="hidden" id="routeSource">
    <input type="hidden" id="routeId">
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
      <label>\u76EE\u6807\u5730\u5740 (target)</label>
      <textarea id="routeTarget" rows="3" placeholder="https://emby.example.com:8096&#10;https://emby-backup.example.com:8096"></textarea>
      <p class="form-hint">\u4E00\u884C\u4E00\u4E2A\u5730\u5740\uFF08\u4E5F\u652F\u6301\u9017\u53F7\u5206\u9694\uFF09\uFF0C\u6309\u987A\u5E8F\u6545\u969C\u8F6C\u79FB</p>
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
    <div class="form-group">
      <label>\u5BA2\u6237\u7AEF IP</label>
      <select id="routeIpMode">
        <option value="forward">\u9ED8\u8BA4\u6A21\u5F0F\uFF08\u900F\u4F20\u5BA2\u6237\u7AEF IP\uFF09</option>
        <option value="strip">\u4E0D\u900F\u4F20 IP\uFF08\u4E0D\u53D1\u9001 X-Forwarded-For / X-Real-IP\uFF09</option>
        <option value="disable">\u5F7B\u5E95\u9690\u85CF\uFF08\u5265\u79BB\u6240\u6709\u5BA2\u6237\u7AEF\u8EAB\u4EFD\u5934\uFF09</option>
      </select>
      <p class="form-hint">\u53CD\u4EE3\u76EE\u6807\u4E5F\u662F Cloudflare \u7AD9\u70B9\u65F6\u5EFA\u8BAE\u9009\u300C\u5F7B\u5E95\u9690\u85CF\u300D\uFF0C\u6E90\u7AD9\u5C06\u53EA\u80FD\u770B\u5230 Worker \u51FA\u53E3 IP</p>
    </div>
    <div class="form-group">
      <label>\u81EA\u5B9A\u4E49\u8BF7\u6C42\u5934\uFF08\u53EF\u9009\uFF09</label>
      <textarea id="routeHeaders" rows="3" placeholder="User-Agent: Emby/4.8&#10;Origin: https://example.com"></textarea>
      <p class="form-hint">\u6BCF\u884C\u4E00\u4E2A Name: Value\uFF0C\u4F1A\u8986\u76D6\u8F6C\u53D1\u7ED9\u4E0A\u6E38\u7684\u540C\u540D\u8BF7\u6C42\u5934\uFF0C\u53EF\u7528\u4E8E\u5E94\u5BF9\u9632\u76D7\u94FE</p>
    </div>
    <div class="form-group">
      <label>IP \u767D\u540D\u5355\uFF08\u53EF\u9009\uFF09</label>
      <input id="routeIpAllow" placeholder="\u7559\u7A7A\u8868\u793A\u4E0D\u9650\u5236\uFF0C\u4F8B\u5982 1.2.3.4, 10.0.0.0/8">
      <label style="margin-top:12px">IP \u9ED1\u540D\u5355\uFF08\u53EF\u9009\uFF09</label>
      <input id="routeIpBlock" placeholder="\u4F8B\u5982 5.6.7.8">
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal('modalRoute')">\u53D6\u6D88</button>
      <button class="btn btn-solid" onclick="saveRoute()">\u4FDD\u5B58</button>
    </div>
  </div>
</div>

${adminModals}

<script>${THEME_LOGIC}
var IS_ADMIN = ${isAdmin2 ? "true" : "false"};
var USERNAME = '${username}';
var ROUTE_API = IS_ADMIN ? '/admin/api/routes' : '/api/user/routes';
var allRoutes = [];
var allDomains = [];
var allUsers = [];
var allInvites = [];
var bestDomain = null;
var quickDns = null;

function showToast(msg, ms) {
  var t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function() { t.classList.remove('show'); }, ms || 2600);
}

function closeModal(id) { document.getElementById(id).classList.remove('show'); }
function openModal(id) { document.getElementById(id).classList.add('show'); }

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

async function logout() {
  try { await fetch('/api/logout', { method: 'POST' }); } catch (e) {}
  location.href = '/admin';
}

function fmtB(n) {
  n = Number(n) || 0;
  if (n < 1024) return n + ' B';
  var u = ['KB', 'MB', 'GB', 'TB'], i = -1;
  do { n /= 1024; i++; } while (n >= 1024 && i < u.length - 1);
  return n.toFixed(2) + ' ' + u[i];
}

async function postJson(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  let d = {};
  try { d = await r.json(); } catch (e) {}
  return { ok: r.ok, data: d };
}

// ===== \u8DEF\u7531\uFF08\u7BA1\u7406\u5458=\u5168\u5C40\u8DEF\u7531\uFF1B\u666E\u901A\u7528\u6237=\u81EA\u5DF1\u7684\u8DEF\u7531\uFF09=====
async function loadRoutes() {
  try {
    const r = await fetch(ROUTE_API);
    if (r.status === 401) { location.href = '/admin'; return; }
    const d = await r.json();
    allRoutes = Array.isArray(d) ? d : [];
    renderRoutes(allRoutes);
  } catch (e) {
    document.getElementById('routeList').innerHTML = '<p class="muted">\u52A0\u8F7D\u5931\u8D25: ' + esc(e.message) + '</p>';
  }
}

function renderRoutes(list) {
  const el = document.getElementById('routeList');
  var countChip = document.getElementById('routeCount');
  if (countChip) countChip.textContent = list.length + ' \u6761';
  if (!list.length) {
    el.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><span class="empty-state-icon">\u{1F4E6}</span><p class="empty-state-text">\u6682\u65E0\u8DEF\u7531\uFF0C\u70B9\u51FB\u4E0A\u65B9\u6309\u94AE\u6DFB\u52A0</p></div>';
    return;
  }
  el.innerHTML = list.map(function(r, ri) {
    const targets = String(r.target || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean);
    const remarkName = r.remark || '\u672A\u547D\u540D';
    const cacheStatus = r.cache_img !== 'off';
    const compatStatus = r.compat_mode === 'on';
    let targetsHtml = '';
    targets.forEach(function(t, idx) {
      const tag = idx === 0 ? '<span style="color:var(--ok);font-weight:700">[\u4E3B]</span>' : '<span style="color:var(--warn);font-weight:700">[\u5907' + idx + ']</span>';
      targetsHtml += '<div class="target-row">' + tag + ' <span class="target-url"><code>' + esc(t) + '</code></span></div>';
    });
    const disabled = r.enabled === 0;
    const isLegacy = r.source === 'legacy';
    const srcAttr = isLegacy ? ' data-source="legacy"' : '';
    return '<div class="route-item" style="' + (disabled ? 'opacity:.55' : '') + '" data-search="' + esc((remarkName + ' ' + r.prefix).toLowerCase()) + '">' +
      '<div class="route-header"><div class="route-title">' +
        '<h3 class="route-name">' + esc(remarkName) + '</h3>' +
        '<span class="route-path">/' + esc(r.prefix) + '</span>' +
      '</div></div>' +
      '<div class="target-list">' + targetsHtml + '</div>' +
      '<div class="route-meta">' +
        (disabled ? '<span class="meta-tag" style="color:var(--warn);border-color:var(--warn-dim)">\u23F8 \u5DF2\u505C\u7528</span>' : '') +
        (isLegacy ? '<span class="meta-tag" style="color:var(--info);border-color:var(--info-dim)">\u{1F4DC} \u5386\u53F2\u8DEF\u7531</span>' : '') +
        (r.down_count ? '<span class="meta-tag" style="color:var(--warn);border-color:var(--warn-dim)">\u{1F534} ' + r.down_count + ' \u6761\u7EBF\u8DEF\u5F02\u5E38</span>' : '') +
        (cacheStatus ? '<span class="meta-tag">\u{1F5BC}\uFE0F \u7F13\u5B58\u5F00\u542F</span>' : '<span class="meta-tag">\u7F13\u5B58\u5173\u95ED</span>') +
        (compatStatus ? '<span class="meta-tag" style="color:var(--warn);border-color:var(--warn-dim)">\u{1F527} \u517C\u5BB9\u6A21\u5F0F</span>' : '') +
        (r.ip_mode === 'strip' ? '<span class="meta-tag" style="color:var(--info);border-color:var(--info-dim)">\u{1F6E1}\uFE0F IP\u4E0D\u900F\u4F20</span>' : '') +
        (r.ip_mode === 'disable' ? '<span class="meta-tag" style="color:var(--ok);border-color:var(--ok-dim)">\u{1F6E1}\uFE0F IP\u5F7B\u5E95\u9690\u85CF</span>' : '') +
        (r.today_req ? '<span class="meta-tag">\u{1F4CA} \u4ECA\u65E5 ' + r.today_req + ' \u6B21 / ' + fmtB(r.today_bytes) + '\uFF08\u5386\u53F2\uFF09</span>' : '') +
        (r.last_play ? '<span class="meta-tag">\u{1F4FA} \u6700\u8FD1\u64AD\u653E ' + esc(String(r.last_play).slice(5, 16)) + '</span>' : '') +
      '</div>' +
      '<div class="route-actions">' +
        '<button class="btn btn-sm" data-act="up" data-prefix="' + esc(r.prefix) + '"' + srcAttr + (ri === 0 ? ' disabled' : '') + '>\u2191</button>' +
        '<button class="btn btn-sm" data-act="down" data-prefix="' + esc(r.prefix) + '"' + srcAttr + (ri === list.length - 1 ? ' disabled' : '') + '>\u2193</button>' +
        '<button class="btn btn-sm" data-act="test" data-prefix="' + esc(r.prefix) + '"' + srcAttr + '>\u6D4B\u8BD5</button>' +
        '<button class="btn btn-sm" data-act="toggle" data-prefix="' + esc(r.prefix) + '"' + srcAttr + ' data-enabled="' + (disabled ? '1' : '0') + '">' + (disabled ? '\u542F\u7528' : '\u505C\u7528') + '</button>' +
        '<button class="btn btn-sm" data-act="edit" data-prefix="' + esc(r.prefix) + '"' + srcAttr + ' data-id="' + esc(r.id || '') + '">\u7F16\u8F91</button>' +
        '<button class="btn btn-sm btn-danger" data-act="del" data-prefix="' + esc(r.prefix) + '"' + srcAttr + '>\u5220\u9664</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

document.getElementById('routeList').addEventListener('click', function(ev) {
  var btn = ev.target.closest('button[data-act]');
  if (!btn) return;
  var a = btn.dataset.act, pf = btn.dataset.prefix, src = btn.dataset.source || '';
  if (a === 'edit') editRoute(pf);
  else if (a === 'del') delRoute(pf, src);
  else if (a === 'toggle') toggleRoute(pf, btn.dataset.enabled === '1', src);
  else if (a === 'test') testRoute(pf, btn, src);
  else if (a === 'up') moveRoute(pf, -1);
  else if (a === 'down') moveRoute(pf, 1);
});

async function toggleRoute(prefix, enable, source) {
  const x = await postJson(ROUTE_API + '/toggle', { prefix: prefix, enabled: enable, source: source || '' });
  showToast(x.ok ? (enable ? '\u5DF2\u542F\u7528' : '\u5DF2\u505C\u7528') : (x.data.error || '\u64CD\u4F5C\u5931\u8D25'));
  loadRoutes();
}

async function moveRoute(prefix, dir) {
  const order = allRoutes.map(function(r) { return r.prefix; });
  const i = order.indexOf(prefix), j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return;
  order.splice(j, 0, order.splice(i, 1)[0]);
  await postJson(ROUTE_API + '/reorder', { order: order });
  loadRoutes();
}

async function testRoute(prefix, btn, source) {
  btn.disabled = true; btn.textContent = '\u6D4B\u8BD5\u4E2D';
  const x = await postJson(ROUTE_API + '/test', { prefix: prefix, source: source || '' });
  btn.disabled = false; btn.textContent = '\u6D4B\u8BD5';
  if (!x.ok) { showToast(x.data.error || '\u6D4B\u8BD5\u5931\u8D25'); return; }
  showToast(x.data.results.map(function(r, i) {
    return (i === 0 ? '\u4E3B' : '\u5907' + i) + ' ' + (r.ok ? r.ms + 'ms' : '\u5931\u8D25');
  }).join('  |  '));
}

function filterRoutes() {
  const q = document.getElementById('routeSearch').value.toLowerCase();
  document.querySelectorAll('.route-item').forEach(function(c) {
    c.style.display = (!q || c.dataset.search.indexOf(q) >= 0) ? 'block' : 'none';
  });
}

function openRouteModal() {
  document.getElementById('oldPrefix').value = '';
  document.getElementById('routeSource').value = '';
  document.getElementById('routeId').value = '';
  document.getElementById('routeRemark').value = '';
  document.getElementById('routePrefix').value = '';
  document.getElementById('routeTarget').value = '';
  document.getElementById('routeCache').checked = true;
  document.getElementById('routeCompat').checked = false;
  document.getElementById('routeIpMode').value = 'forward';
  document.getElementById('routeHeaders').value = '';
  document.getElementById('routeIpAllow').value = '';
  document.getElementById('routeIpBlock').value = '';
  document.getElementById('prefixPreview').textContent = 'myemby';
  document.getElementById('routeModalTitle').textContent = '\u6DFB\u52A0\u8DEF\u7531';
  openModal('modalRoute');
}

function editRoute(prefix) {
  const r = allRoutes.find(function(x) { return x.prefix === prefix; });
  if (!r) return;
  document.getElementById('oldPrefix').value = r.prefix;
  document.getElementById('routeSource').value = r.source === 'legacy' ? 'legacy' : '';
  document.getElementById('routeId').value = r.id || '';
  document.getElementById('routeRemark').value = r.remark || '';
  document.getElementById('routePrefix').value = r.prefix;
  document.getElementById('routeTarget').value = String(r.target || '').split(',').map(function(x) { return x.trim(); }).filter(Boolean).join('\\n');
  document.getElementById('routeCache').checked = r.cache_img !== 'off';
  document.getElementById('routeCompat').checked = r.compat_mode === 'on';
  document.getElementById('routeIpMode').value = (r.ip_mode === 'strip' || r.ip_mode === 'disable') ? r.ip_mode : 'forward';
  document.getElementById('routeHeaders').value = r.custom_headers || '';
  document.getElementById('routeIpAllow').value = r.ip_allow || '';
  document.getElementById('routeIpBlock').value = r.ip_block || '';
  document.getElementById('prefixPreview').textContent = r.prefix;
  document.getElementById('routeModalTitle').textContent = '\u7F16\u8F91\u8DEF\u7531';
  openModal('modalRoute');
}

async function saveRoute() {
  const oldPrefix = document.getElementById('oldPrefix').value;
  const remark = document.getElementById('routeRemark').value.trim();
  let prefix = document.getElementById('routePrefix').value.trim();
  while (prefix.startsWith('/')) prefix = prefix.slice(1);
  while (prefix.endsWith('/')) prefix = prefix.slice(0, -1);
  const target = document.getElementById('routeTarget').value.split(/[\\r\\n,]+/).map(function(s) { return s.trim(); }).filter(Boolean).join(',');
  if (!prefix) { showToast('\u8BF7\u8F93\u5165\u8DEF\u5F84'); return; }
  if (!target) { showToast('\u8BF7\u81F3\u5C11\u586B\u5199\u4E00\u4E2A\u76EE\u6807\u5730\u5740'); return; }

  const r = await fetch(ROUTE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      oldPrefix: oldPrefix, prefix: prefix, target: target, remark: remark,
      source: document.getElementById('routeSource').value || '',
      routeId: document.getElementById('routeId').value || '',
      cache_img: document.getElementById('routeCache').checked ? 'on' : 'off',
      compat_mode: document.getElementById('routeCompat').checked ? 'on' : 'off',
      ip_mode: document.getElementById('routeIpMode').value || 'forward',
      custom_headers: document.getElementById('routeHeaders').value,
      ip_allow: document.getElementById('routeIpAllow').value,
      ip_block: document.getElementById('routeIpBlock').value
    })
  });
  const d = await r.json();
  if (!r.ok) { showToast(d.error || '\u4FDD\u5B58\u5931\u8D25'); return; }
  closeModal('modalRoute');
  showToast('\u4FDD\u5B58\u6210\u529F');
  loadRoutes();
  if (!IS_ADMIN) loadUserEntry();
}

async function delRoute(prefix, source) {
  if (!confirm('\u786E\u5B9A\u5220\u9664\u8DEF\u7531 /' + prefix + ' \uFF1F')) return;
  await fetch(ROUTE_API + '?prefix=' + encodeURIComponent(prefix) + (source ? '&source=' + encodeURIComponent(source) : ''), { method: 'DELETE' });
  showToast('\u5DF2\u5220\u9664');
  loadRoutes();
  if (!IS_ADMIN) loadUserEntry();
}

// ===== \u7EDF\u8BA1 =====
async function loadStats() {
  try {
    const r = await fetch(IS_ADMIN ? '/admin/api/stats' : '/api/user/stats');
    if (r.status === 401) { location.href = '/admin'; return; }
    const d = await r.json();
    if (d.error) { document.getElementById('stats-loading').textContent = d.error; return; }
    document.getElementById('stats-loading').style.display = 'none';
    document.getElementById('stats-body').style.display = 'block';
    const data = d.data || {};
    const isUserScope = data.scope === 'user';
    const src = data.statsSource || 'unavailable';
    const srcLabel = src === 'account' ? 'CF \u8D26\u53F7\u5206\u6790\uFF08\u6574\u4E2A\u57DF\u540D\uFF09' : (src === 'zone' ? 'CF Zone Analytics\uFF08\u4EC5\u4E3B\u57DF\u540D\uFF09' : 'CF \u6570\u636E\u4E0D\u53EF\u7528');
    document.getElementById('st-req').textContent = data.todayRequests == null ? '\u2014' : data.todayRequests;
    document.getElementById('st-req-sub').textContent = '\u6765\u6E90: ' + (isUserScope ? (src === 'account' ? 'CF \u8D26\u53F7\u5206\u6790\uFF08\u6211\u7684\u57DF\u540D\uFF09' : srcLabel) : srcLabel);
    document.getElementById('st-traffic').textContent = data.todayTraffic || '\u2014';
    document.getElementById('st-traffic-sub').textContent = '\u6765\u6E90: ' + (isUserScope ? (src === 'account' ? '\u771F\u5B9E\u51FA\u7AD9\u6D41\u91CF\uFF08CF \u8D26\u53F7\u5206\u6790\xB7\u6211\u7684\u57DF\u540D\uFF09' : 'CF \u6570\u636E\u4E0D\u53EF\u7528') : (src === 'account' ? '\u771F\u5B9E\u51FA\u7AD9\u6D41\u91CF\uFF08CF \u8D26\u53F7\u5206\u6790\xB7\u6574\u4E2A\u57DF\u540D\uFF09' : (src === 'zone' ? 'CF edgeResponseBytes\uFF08\u4EC5\u4E3B\u57DF\u540D\uFF09' : 'CF \u6570\u636E\u4E0D\u53EF\u7528')));
    document.getElementById('st-uv').textContent = data.todayVisits == null ? '\u2014' : data.todayVisits;
    document.getElementById('st-uv-sub').textContent = isUserScope ? '\u7528\u6237\u7EF4\u5EA6\u4E0D\u7EDF\u8BA1\u72EC\u7ACB\u8BBF\u95EE' : '\u6765\u6E90: CF \u72EC\u7ACB\u8BBF\u95EE\uFF08\u5168\u7AD9\uFF09';
    var chip = document.getElementById('statsChip');
    if (chip) chip.textContent = data.cfStatus || (isUserScope ? 'CF' : 'STATS');
    const envInfo = data.envInfo || {};
    document.getElementById('st-updated').textContent = '\u66F4\u65B0\u65F6\u95F4 ' + (data.lastUpdated || '')
      + ' \xB7 ' + (data.cfStatus || '')
      + (envInfo.statsHost ? ' \xB7 \u7EDF\u8BA1\u57DF\u540D ' + envInfo.statsHost : '')
      + (data.cfError ? ' (' + data.cfError + ')' : '');
    const hourly = data.hourlySeries || [];
    if (hourly.length) {
      const max = Math.max(1, Math.max.apply(null, hourly.map(function(h) { return h.total; })));
      let hhtml = '<div class="chart">';
      hourly.forEach(function(h) {
        const ht = Math.max(2, Math.round((h.total / max) * 68));
        const label = h.label || '';
        hhtml += '<div class="chart-col" title="' + label + ' \xB7 ' + h.total + ' \u6B21"><i style="height:' + ht + 'px"></i><b>' + label.slice(0, 2) + '</b></div>';
      });
      hhtml += '</div><p class="muted" style="font-size:11px;margin-top:6px">\u4ECA\u65E5 24 \u5C0F\u65F6\u8BF7\u6C42\u5206\u5E03\uFF08\u4E0A\u6D77\u65F6\u533A\uFF09</p>';
      document.getElementById('hourly-chart').innerHTML = hhtml;
    }
  } catch (e) {
    const el = document.getElementById('stats-loading');
    if (el) el.textContent = '\u7EDF\u8BA1\u52A0\u8F7D\u5931\u8D25';
  }
}

// ===== \u7528\u6237\u4E2D\u5FC3 =====
async function loadUserEntry() {
  if (IS_ADMIN) return;
  try {
    const results = await Promise.all([fetch('/api/user/me'), fetch('/api/user/dns')]);
    const me = await results[0].json();
    let dns = {};
    try { dns = await results[1].json(); } catch (e) {}
    document.getElementById('entryUser').textContent = me.user ? me.user.username : USERNAME;
    document.getElementById('entryHost').textContent = me.entryHost || '\u672A\u914D\u7F6E';
    document.getElementById('entryRoutes').textContent = (me.routeCount || 0) + ' / ' + (me.routeLimit || 0) + ' \u6761';
    const entryUrl = document.getElementById('entryUrl');
    if (me.entryUrl) {
      entryUrl.href = me.entryUrl;
      entryUrl.textContent = '\u6253\u5F00 ' + me.entryHost;
    } else {
      entryUrl.href = '#';
      entryUrl.textContent = '\u6253\u5F00\u5165\u53E3';
    }
    const hint = document.getElementById('entryHint');
    if (hint) hint.textContent = me.workerRouteHint || '';
    const limitHint = document.getElementById('routeLimitHint');
    if (limitHint) limitHint.textContent = '\u5DF2\u7528 ' + (me.routeCount || 0) + ' / ' + (me.routeLimit || 0) + ' \u6761\u8DEF\u7531';
    const dnsEl = document.getElementById('entryDns');
    if (dns.record) {
      dnsEl.textContent = '[' + dns.record.type + '] ' + dns.record.content + (dns.record.proxied ? '\uFF08\u5DF2\u4EE3\u7406\uFF09' : '\uFF08\u5C0F\u9EC4\u4E91\u5173\u95ED\uFF09');
    } else if (dns.zoneError) {
      dnsEl.textContent = '\u26A0\uFE0F ' + dns.zoneError;
    } else {
      dnsEl.textContent = '\u5C1A\u672A\u521B\u5EFA';
    }
    const dnsInput = document.getElementById('entryDnsValue');
    if (dnsInput) dnsInput.value = dns.record ? dns.record.content : (dns.defaultTarget || 'youxuan.cf.090227.xyz');
  } catch (e) {
    const el = document.getElementById('entryHost');
    if (el) el.textContent = '\u52A0\u8F7D\u5931\u8D25';
  }
}

async function saveUserDNS(btn) {
  const input = document.getElementById('entryDnsValue');
  const target = input ? input.value.trim() : '';
  if (!target) { showToast('\u8BF7\u8F93\u5165 IP \u6216\u57DF\u540D'); return; }
  if (btn) { btn.disabled = true; btn.textContent = '\u4FDD\u5B58\u4E2D...'; }
  try {
    const r = await fetch('/api/user/dns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target }) });
    const d = await r.json().catch(function() { return {}; });
    if (r.ok && d.ok) {
      showToast('\u2705 ' + (d.type || 'CNAME') + ' ' + d.entryHost + ' \u2192 ' + d.target + '\uFF08\u5C0F\u9EC4\u4E91\u5173\u95ED\uFF09', 5000);
      loadUserEntry();
    } else {
      showToast('\u274C ' + (d.error || '\u4FDD\u5B58\u5931\u8D25'), 7000);
    }
  } catch (e) {
    showToast('\u274C \u8BF7\u6C42\u5931\u8D25: ' + e.message);
  }
  if (btn) { btn.disabled = false; btn.textContent = '\u4FDD\u5B58 DNS \u503C'; }
}

async function ensureUserDNS(btn) {
  if (btn) { btn.disabled = true; btn.textContent = '\u521B\u5EFA\u4E2D...'; }
  try {
    const r = await fetch('/api/user/dns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const d = await r.json();
    if (d.ok) {
      showToast('\u2705 ' + (d.type || 'CNAME') + ' ' + d.entryHost + ' \u2192 ' + d.target + '\uFF08\u5C0F\u9EC4\u4E91\u5173\u95ED\uFF09', 5000);
      loadUserEntry();
    } else {
      showToast('\u274C ' + (d.error || '\u521B\u5EFA\u5931\u8D25'), 7000);
    }
  } catch (e) {
    showToast('\u274C \u8BF7\u6C42\u5931\u8D25: ' + e.message);
  }
  if (btn) { btn.disabled = false; btn.textContent = '\u91CD\u65B0\u521B\u5EFA DNS'; }
}

async function changePassword() {
  const oldPassword = prompt('\u8BF7\u8F93\u5165\u539F\u5BC6\u7801');
  if (!oldPassword) return;
  const newPassword = prompt('\u8BF7\u8F93\u5165\u65B0\u5BC6\u7801\uFF08\u81F3\u5C11 6 \u4F4D\uFF09');
  if (!newPassword) return;
  const confirmPassword = prompt('\u8BF7\u518D\u6B21\u8F93\u5165\u65B0\u5BC6\u7801');
  if (newPassword !== confirmPassword) { showToast('\u4E24\u6B21\u8F93\u5165\u4E0D\u4E00\u81F4'); return; }
  const x = await postJson('/api/user/password', { oldPassword: oldPassword, newPassword: newPassword });
  showToast(x.ok ? '\u2705 \u5BC6\u7801\u5DF2\u4FEE\u6539' : ('\u274C ' + (x.data.error || '\u4FEE\u6539\u5931\u8D25')));
}

// ===== \u7BA1\u7406\u5458\uFF1A\u7528\u6237 / \u9080\u8BF7\u7801 =====
async function loadUsers() {
  if (!IS_ADMIN) return;
  try {
    const r = await fetch('/admin/api/users');
    const d = await r.json();
    allUsers = d.users || [];
    renderUsers(allUsers);
  } catch (e) {
    document.getElementById('userList').textContent = '\u52A0\u8F7D\u5931\u8D25: ' + e.message;
  }
}

function renderUsers(list) {
  const el = document.getElementById('userList');
  const chip = document.getElementById('userCount');
  if (chip) chip.textContent = list.length + ' \u4EBA';
  if (!list.length) { el.innerHTML = '<p class="muted">\u6682\u65E0\u7528\u6237\uFF0C\u70B9\u4E0A\u65B9\u6309\u94AE\u521B\u5EFA</p>'; return; }
  let html = '<div style="overflow-x:auto"><table><thead><tr><th>\u7528\u6237\u540D</th><th>\u5B50\u57DF\u540D</th><th>\u89D2\u8272</th><th>\u72B6\u6001</th><th>\u8DEF\u7531</th><th>\u6700\u8FD1\u767B\u5F55</th><th>\u64CD\u4F5C</th></tr></thead><tbody>';
  list.forEach(function(u) {
    const disabled = u.status === 'disabled';
    html += '<tr' + (disabled ? ' style="opacity:.55"' : '') + '>' +
      '<td><code>' + esc(u.username) + '</code></td>' +
      '<td><code>' + esc(u.subdomain || '\u2014') + '</code></td>' +
      '<td>' + (u.role === 'admin' ? '\u7BA1\u7406\u5458' : '\u666E\u901A\u7528\u6237') + '</td>' +
      '<td>' + (disabled ? '<span style="color:var(--warn)">\u7981\u7528</span>' : '<span style="color:var(--ok)">\u6B63\u5E38</span>') + '</td>' +
      '<td>' + (u.routeCount || 0) + ' / ' + (u.routeLimit || 0) + '</td>' +
      '<td style="white-space:nowrap">' + (u.lastLogin ? esc(String(u.lastLogin).replace('T', ' ').slice(0, 16)) + ' UTC' : '<span class="muted">\u4ECE\u672A\u767B\u5F55</span>') + '</td>' +
      '<td style="white-space:nowrap">' +
        '<button class="btn btn-sm" onclick="editUser(' + u.id + ')">\u7F16\u8F91</button> ' +
        '<button class="btn btn-sm" onclick="toggleUser(' + u.id + ',' + (disabled ? 'true' : 'false') + ')">' + (disabled ? '\u542F\u7528' : '\u7981\u7528') + '</button> ' +
        '<button class="btn btn-sm btn-danger" onclick="delUser(' + u.id + ')">\u5220\u9664</button>' +
      '</td></tr>';
  });
  html += '</tbody></table></div>';
  el.innerHTML = html;
}

function openUserModal(id) {
  const u = id ? allUsers.find(function(x) { return x.id === id; }) : null;
  document.getElementById('userId').value = u ? u.id : '';
  document.getElementById('userUsername').value = u ? u.username : '';
  document.getElementById('userUsername').disabled = Boolean(u);
  document.getElementById('userPassword').value = '';
  document.getElementById('userPassword').placeholder = u ? '\u7559\u7A7A\u8868\u793A\u4E0D\u4FEE\u6539\u5BC6\u7801' : '\u81F3\u5C11 6 \u4F4D';
  document.getElementById('userSubdomain').value = u ? (u.subdomain || '') : '';
  document.getElementById('userRole').value = u ? (u.role || 'user') : 'user';
  document.getElementById('userStatus').value = u ? (u.status || 'active') : 'active';
  document.getElementById('userRouteLimit').value = u ? (u.routeLimit || 20) : 20;
  document.getElementById('userModalTitle').textContent = u ? '\u7F16\u8F91\u7528\u6237' : '\u6DFB\u52A0\u7528\u6237';
  openModal('modalUser');
}

function editUser(id) { openUserModal(id); }

async function saveUser() {
  const id = document.getElementById('userId').value;
  const data = {
    username: document.getElementById('userUsername').value.trim(),
    password: document.getElementById('userPassword').value,
    subdomain: document.getElementById('userSubdomain').value.trim(),
    role: document.getElementById('userRole').value,
    status: document.getElementById('userStatus').value,
    route_limit: document.getElementById('userRouteLimit').value
  };
  if (!data.username) { showToast('\u8BF7\u8F93\u5165\u7528\u6237\u540D'); return; }
  if (!id && !data.password) { showToast('\u8BF7\u8F93\u5165\u5BC6\u7801'); return; }
  const r = await fetch(id ? '/admin/api/users/' + id : '/admin/api/users', {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const d = await r.json();
  if (!r.ok) { showToast(d.error || '\u4FDD\u5B58\u5931\u8D25'); return; }
  closeModal('modalUser');
  if (d.dnsWarning) showToast('\u5DF2\u4FDD\u5B58\uFF0C\u4F46\u81EA\u52A8\u521B\u5EFA DNS \u5931\u8D25\uFF1A' + d.dnsWarning, 8000);
  else if (d.dns) showToast('\u5DF2\u4FDD\u5B58\uFF0C\u5DF2\u81EA\u52A8\u521B\u5EFA DNS\uFF1A' + d.dns.entryHost + ' \u2192 ' + d.dns.target, 5000);
  else showToast('\u4FDD\u5B58\u6210\u529F');
  loadUsers();
}

async function toggleUser(id, enable) {
  const r = await fetch('/admin/api/users/' + id, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: enable ? 'active' : 'disabled' })
  });
  const d = await r.json();
  showToast(r.ok ? (enable ? '\u5DF2\u542F\u7528' : '\u5DF2\u7981\u7528') : (d.error || '\u64CD\u4F5C\u5931\u8D25'));
  loadUsers();
}

async function delUser(id) {
  const u = allUsers.find(function(x) { return x.id === id; });
  if (!confirm('\u786E\u5B9A\u5220\u9664\u7528\u6237 ' + (u ? u.username : id) + ' \uFF1F\u5176\u8DEF\u7531\u548C\u7EDF\u8BA1\u4E5F\u4F1A\u88AB\u5220\u9664\u3002')) return;
  const r = await fetch('/admin/api/users/' + id, { method: 'DELETE' });
  const d = await r.json();
  showToast(r.ok ? '\u5DF2\u5220\u9664' : (d.error || '\u5220\u9664\u5931\u8D25'));
  loadUsers();
}

async function loadInvites() {
  if (!IS_ADMIN) return;
  try {
    const r = await fetch('/admin/api/invites');
    const d = await r.json();
    allInvites = d.invites || [];
    renderInvites(allInvites);
  } catch (e) {
    document.getElementById('inviteList').textContent = '\u52A0\u8F7D\u5931\u8D25: ' + e.message;
  }
}

function renderInvites(list) {
  const el = document.getElementById('inviteList');
  if (!list.length) { el.innerHTML = '<p class="muted">\u6682\u65E0\u9080\u8BF7\u7801\uFF0C\u70B9\u4E0A\u65B9\u6309\u94AE\u751F\u6210</p>'; return; }
  let html = '<div style="overflow-x:auto"><table><thead><tr><th>\u9080\u8BF7\u7801</th><th>\u4F7F\u7528</th><th>\u8FC7\u671F</th><th>\u5907\u6CE8</th><th>\u64CD\u4F5C</th></tr></thead><tbody>';
  list.forEach(function(v) {
    const used = Number(v.usedCount) || 0;
    const max = Number(v.maxUses) || 0;
    html += '<tr>' +
      '<td><code>' + esc(v.code) + '</code></td>' +
      '<td>' + used + ' / ' + (max === 0 ? '\u221E' : max) + '</td>' +
      '<td>' + esc(v.expiresAt ? String(v.expiresAt).slice(0, 10) : '\u2014') + '</td>' +
      '<td>' + esc(v.note || '\u2014') + '</td>' +
      '<td style="white-space:nowrap">' +
        '<button class="btn btn-sm" onclick="copyInvite(\\'' + esc(v.code) + '\\')">\u590D\u5236</button> ' +
        '<button class="btn btn-sm btn-danger" onclick="delInvite(\\'' + esc(v.code) + '\\')">\u5220\u9664</button>' +
      '</td></tr>';
  });
  html += '</tbody></table></div>';
  el.innerHTML = html;
}

function openInviteModal() {
  document.getElementById('inviteCode').value = '';
  document.getElementById('inviteMaxUses').value = '1';
  document.getElementById('inviteExpires').value = '';
  document.getElementById('inviteNote').value = '';
  openModal('modalInvite');
}

async function saveInvite() {
  const data = {
    code: document.getElementById('inviteCode').value.trim(),
    max_uses: document.getElementById('inviteMaxUses').value,
    expires_at: document.getElementById('inviteExpires').value,
    note: document.getElementById('inviteNote').value.trim()
  };
  const x = await postJson('/admin/api/invites', data);
  if (!x.ok) { showToast(x.data.error || '\u751F\u6210\u5931\u8D25'); return; }
  closeModal('modalInvite');
  showToast('\u9080\u8BF7\u7801\uFF1A' + (x.data.invite ? x.data.invite.code : '\u5DF2\u751F\u6210'));
  loadInvites();
}

async function delInvite(code) {
  if (!confirm('\u786E\u5B9A\u5220\u9664\u9080\u8BF7\u7801 ' + code + ' \uFF1F')) return;
  try {
    const r = await fetch('/admin/api/invites/' + encodeURIComponent(code), { method: 'DELETE' });
    const d = await r.json().catch(function() { return {}; });
    if (r.ok) showToast(d.alreadyDeleted ? '\u9080\u8BF7\u7801\u5DF2\u4E0D\u5B58\u5728\uFF0C\u5217\u8868\u5DF2\u5237\u65B0' : '\u2705 \u9080\u8BF7\u7801\u5DF2\u5220\u9664');
    else showToast('\u274C ' + (d.error || '\u5220\u9664\u5931\u8D25'), 5000);
  } catch (e) {
    showToast('\u274C \u5220\u9664\u5931\u8D25: ' + e.message, 5000);
  }
  loadInvites();
}

async function clearInvites() {
  if (!confirm('\u786E\u5B9A\u5220\u9664\u5168\u90E8\u9080\u8BF7\u7801\u5417\uFF1F\\n\\n\u6240\u6709\u672A\u4F7F\u7528\u548C\u5DF2\u4F7F\u7528\u7684\u9080\u8BF7\u7801\u90FD\u4F1A\u88AB\u5220\u9664\uFF0C\u6B64\u64CD\u4F5C\u4E0D\u53EF\u6062\u590D\u3002')) return;
  showToast('\u6B63\u5728\u5220\u9664\u5168\u90E8\u9080\u8BF7\u7801...', 3000);
  const x = await postJson('/admin/api/invites/clear', { confirm: 'CLEAR' });
  if (x.ok) showToast('\u2705 \u5DF2\u5220\u9664\u5168\u90E8\u9080\u8BF7\u7801\uFF08' + ((x.data && x.data.deleted) || 0) + ' \u4E2A\uFF09', 4000);
  else showToast('\u274C ' + ((x.data && x.data.error) || '\u64CD\u4F5C\u5931\u8D25'), 5000);
  loadInvites();
}

function copyInvite(code) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(code).then(function() { showToast('\u5DF2\u590D\u5236\uFF1A' + code); }).catch(function() { prompt('\u590D\u5236\u9080\u8BF7\u7801', code); });
  } else {
    prompt('\u590D\u5236\u9080\u8BF7\u7801', code);
  }
}

async function resetStats() {
  if (!confirm('\u786E\u5B9A\u6E05\u7A7A\u6240\u6709\u7EDF\u8BA1\u6570\u636E\u5417\uFF1F\\n\\n\u8DEF\u7531\u3001\u7528\u6237\u3001\u57DF\u540D\u914D\u7F6E\u4F1A\u4FDD\u7559\uFF0C\u6B64\u64CD\u4F5C\u4E0D\u53EF\u6062\u590D\u3002')) return;
  showToast('\u6B63\u5728\u6E05\u7A7A\u7EDF\u8BA1...', 4000);
  const x = await postJson('/admin/api/db/reset', { scope: 'stats', confirm: 'RESET' });
  showToast(x.ok ? '\u2705 \u7EDF\u8BA1\u5DF2\u6E05\u7A7A' : ('\u274C ' + (x.data.error || '\u64CD\u4F5C\u5931\u8D25')), x.ok ? 2600 : 6000);
  loadStats(); loadUsers(); loadAudit();
}

// ===== \u7BA1\u7406\u5458\uFF1A\u8BBE\u7F6E / \u5BFC\u51FA\u5BFC\u5165 / \u57DF\u540D / DNS / \u65E5\u5FD7 =====
async function importConfig(input) {
  const f = input.files && input.files[0];
  input.value = '';
  if (!f) return;
  let data;
  try { data = JSON.parse(await f.text()); } catch (e) { showToast('\u4E0D\u662F\u5408\u6CD5\u7684 JSON \u6587\u4EF6'); return; }
  if (!confirm('\u5BFC\u5165\u5C06\u6309\u8DEF\u5F84\u8986\u76D6\u540C\u540D\u8DEF\u7531\uFF0C\u5E76\u8FFD\u52A0\u4E0D\u5B58\u5728\u7684\u4F18\u9009\u57DF\u540D\uFF0C\u786E\u5B9A\u7EE7\u7EED\uFF1F')) return;
  const x = await postJson('/admin/api/import', data);
  if (!x.ok) { showToast(x.data.error || '\u5BFC\u5165\u5931\u8D25'); return; }
  showToast('\u5BFC\u5165\u5B8C\u6210\uFF1A\u8DEF\u7531 ' + x.data.routes + '\uFF0C\u57DF\u540D ' + x.data.domains + (x.data.skipped.length ? '\uFF0C\u8DF3\u8FC7 ' + x.data.skipped.length : ''));
  loadRoutes(); loadDomains();
}

async function openSettings() {
  const r = await fetch('/admin/api/settings');
  const d = await r.json();
  const s = d.settings || {};
  document.getElementById('setHealth').checked = s.health_check === '1';
  document.getElementById('setDailyReport').checked = String(s.tg_daily_report == null ? '1' : s.tg_daily_report) !== '0';
  document.getElementById('setRate').value = s.rate_limit_per_min || '0';
  document.getElementById('setManual').value = s.manual_redirect_domains || '';
  document.getElementById('setRules').value = s.domain_proxy_rules || '';
  const n = d.notify || {};
  document.getElementById('notifyHint').textContent = (n.telegram || n.webhook)
    ? '\u901A\u77E5\u6E20\u9053\uFF1A' + [n.telegram ? 'Telegram' : '', n.webhook ? 'Webhook' : ''].filter(Boolean).join(' + ')
      + '\uFF08Token: ' + (n.tokenVar || '\u2014') + '\uFF0CChat: ' + (n.chatVar || '\u2014') + '\uFF09'
    : '\u5C1A\u672A\u914D\u7F6E\u901A\u77E5\uFF1A\u8BF7\u8BBE\u7F6E TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID\uFF08\u517C\u5BB9 TG_*\uFF09\uFF0C\u6216 NOTIFY_WEBHOOK';
  loadRelayCard();
  openModal('modalSettings');
}

// ===== VPS \u4E2D\u7EE7\u914D\u7F6E\u5361\uFF08v6.8.0\uFF1Bv6.8.3 \u589E\u52A0\u7528\u91CF\u7EDF\u8BA1\u5C55\u793A\uFF09=====
async function loadRelayCard() {
  try {
    const r = await fetch('/admin/api/relay');
    const d = await r.json();
    document.getElementById('setRelayUrl').value = d.relay_url || '';
    document.getElementById('setRelaySecret').value = '';
    document.getElementById('setRelaySecret').placeholder = d.has_secret ? '\u5DF2\u914D\u7F6E\uFF08' + d.secret_hint + '\uFF09\uFF0C\u7559\u7A7A\u8868\u793A\u4E0D\u4FEE\u6539' : '\u7559\u7A7A\u8868\u793A\u4E0D\u4FEE\u6539\u5BC6\u94A5';
    document.getElementById('setRelayEnabled').checked = d.relay_enabled === '1';
    document.getElementById('relayTestResult').textContent = d.active ? '\u5F53\u524D\u72B6\u6001\uFF1A\u5DF2\u542F\u7528' : '\u5F53\u524D\u72B6\u6001\uFF1A\u672A\u542F\u7528';
  } catch (e) { /* \u5FFD\u7565 */ }
  loadRelayUsage();
}

// \u901A\u7528\u503C\u6E32\u67D3\uFF1A\u6570\u5B57\u52A0\u5343\u5206\u4F4D\uFF0C\u5BF9\u8C61\u9012\u5F52\uFF0C\u5B57\u7B26\u4E32\u539F\u6837
function relayVal(v) {
  if (v == null) return '';
  if (typeof v === 'number') return v.toLocaleString();
  if (typeof v === 'object') {
    return Object.keys(v).map(function(k) { return k + ': ' + relayVal(v[k]); }).join(' \xB7 ');
  }
  return String(v);
}

async function loadRelayUsage() {
  const el = document.getElementById('relayUsage');
  if (!el) return;
  try {
    const r = await fetch('/admin/api/relay/usage');
    const d = await r.json();
    if (!d.ok) {
      el.innerHTML = '<span style="color:var(--warn)">\u26A0\uFE0F VPS \u7EDF\u8BA1' + (d.error ? '\uFF1A' + esc(d.error) : '\uFF1A\u4E2D\u7EE7\u4E0D\u53EF\u8FBE') + '</span>';
      return;
    }
    const usageHtml = d.usage ? esc(relayVal(d.usage)) : 'VPS \u672A\u63D0\u4F9B';
    const limitsHtml = d.limits ? esc(relayVal(d.limits)) : '';
    el.innerHTML =
      '\u{1F4CA} \u4E2D\u7EE7\u7528\u91CF\uFF1A<b>' + usageHtml + '</b><br>' +
      (limitsHtml ? '\u9650\u989D\uFF1A' + limitsHtml + '<br>' : '') +
      '\u7248\u672C\uFF1A' + esc(d.version || '\u2014') + '<br>' +
      '\u8FD1 24h \u4E2D\u7ED4\u56DE\u9000\uFF1A<b>' + (d.fallback24 || 0) + '</b> \u6B21' + (d.fallbackErr24 ? '\uFF08\u76F4\u8FDE\u5931\u8D25 ' + d.fallbackErr24 + '\uFF09' : '');
  } catch (e) {
    el.textContent = 'VPS \u7EDF\u8BA1\u52A0\u8F7D\u5931\u8D25';
  }
}

async function saveRelay() {
  const body = {
    relay_url: document.getElementById('setRelayUrl').value.trim(),
    relay_enabled: document.getElementById('setRelayEnabled').checked ? '1' : '0'
  };
  const secret = document.getElementById('setRelaySecret').value.trim();
  if (secret) body.relay_secret = secret;
  const x = await postJson('/admin/api/relay', body);
  if (!x.ok) { showToast(x.data.error || '\u4FDD\u5B58\u5931\u8D25'); return false; }
  return true;
}

async function testRelay() {
  const el = document.getElementById('relayTestResult');
  el.textContent = '\u6D4B\u8BD5\u4E2D...';
  const saved = await saveRelay();
  if (!saved) { el.textContent = '\u8BF7\u5148\u586B\u5199\u5730\u5740/\u5BC6\u94A5'; return; }
  const x = await postJson('/admin/api/relay/test', {});
  if (!x.ok) { showToast(x.data.error || '\u8BF7\u6C42\u5931\u8D25'); el.textContent = '\u6D4B\u8BD5\u5931\u8D25'; return; }
  const d = x.data;
  if (d.ok) {
    el.textContent = '\u8054\u901A ' + d.ms + 'ms' + (d.version ? ' \xB7 ' + d.version : '') + (d.auto_enabled ? ' \xB7 \u5DF2\u81EA\u52A8\u542F\u7528\u4E2D\u7EE7' : '');
    document.getElementById('setRelayEnabled').checked = true;
    showToast('\u4E2D\u7EE7\u8054\u901A\uFF0C\u6240\u6709\u8DEF\u7531\u5DF2\u81EA\u52A8\u542F\u7528');
    loadRelayUsage();
  } else {
    el.textContent = '\u5931\u8D25' + (d.error ? '\uFF1A' + d.error : '\uFF08HTTP ' + d.status + '\uFF09');
  }
}

async function saveSettings() {
  const x = await postJson('/admin/api/settings', {
    health_check: document.getElementById('setHealth').checked ? '1' : '0',
    tg_daily_report: document.getElementById('setDailyReport').checked ? '1' : '0',
    rate_limit_per_min: document.getElementById('setRate').value || '0',
    manual_redirect_domains: document.getElementById('setManual').value.trim(),
    domain_proxy_rules: document.getElementById('setRules').value.trim()
  });
  if (!x.ok) { showToast(x.data.error || '\u4FDD\u5B58\u5931\u8D25'); return; }
  await saveRelay();
  closeModal('modalSettings');
  showToast('\u8BBE\u7F6E\u5DF2\u4FDD\u5B58');
}

async function runNow() {
  showToast('\u6267\u884C\u4E2D...');
  const x = await postJson('/admin/api/health/run', {});
  if (!x.ok) { showToast('\u6267\u884C\u5931\u8D25'); return; }
  showToast('\u5DF2\u68C0\u67E5 ' + x.data.checked + ' \u6761\u7EBF\u8DEF\uFF0C\u72B6\u6001\u53D8\u5316 ' + x.data.alerts.length + ' \u6761');
  loadRoutes();
}

var AUDIT_ACTIONS = {
  settings: '\u4FEE\u6539\u8BBE\u7F6E',
  'report.send': '\u53D1\u9001\u65E5\u62A5',
  import: '\u5BFC\u5165\u914D\u7F6E',
  'route.save': '\u4FDD\u5B58\u8DEF\u7531',
  'route.rename': '\u91CD\u547D\u540D\u8DEF\u7531',
  'route.delete': '\u5220\u9664\u8DEF\u7531',
  'route.enable': '\u542F\u7528\u8DEF\u7531',
  'route.disable': '\u7981\u7528\u8DEF\u7531',
  'route.claim': '\u8BA4\u9886\u5386\u53F2\u8DEF\u7531',
  'domain.add': '\u6DFB\u52A0\u4F18\u9009\u57DF\u540D',
  'domain.update': '\u66F4\u65B0\u4F18\u9009\u57DF\u540D',
  'domain.delete': '\u5220\u9664\u4F18\u9009\u57DF\u540D',
  'dns.replace': '\u66FF\u6362 DNS \u8BB0\u5F55',
  'user.register': '\u7528\u6237\u6CE8\u518C',
  'user.create': '\u521B\u5EFA\u7528\u6237',
  'user.update': '\u66F4\u65B0\u7528\u6237',
  'user.delete': '\u5220\u9664\u7528\u6237',
  'user.password': '\u4FEE\u6539\u5BC6\u7801',
  'user.dns': '\u7ED1\u5B9A\u7528\u6237 DNS',
  'user.route.save': '\u4FDD\u5B58\u7528\u6237\u8DEF\u7531',
  'user.route.delete': '\u5220\u9664\u7528\u6237\u8DEF\u7531',
  'invite.create': '\u751F\u6210\u9080\u8BF7\u7801',
  'invite.delete': '\u5220\u9664\u9080\u8BF7\u7801',
  'invite.clear': '\u6E05\u7A7A\u9080\u8BF7\u7801',
  'db.reset': '\u91CD\u7F6E\u6570\u636E\u5E93'
};
var AUDIT_SETTINGS = {
  health_check: '\u7EBF\u8DEF\u5065\u5EB7\u68C0\u67E5',
  tg_daily_report: '\u6BCF\u65E5\u65E5\u62A5',
  rate_limit_per_min: '\u6BCF\u5206\u949F\u8BF7\u6C42\u9650\u5236',
  manual_redirect_domains: '\u624B\u52A8\u8DF3\u8F6C\u57DF\u540D',
  domain_proxy_rules: '\u57DF\u540D\u4EE3\u7406\u89C4\u5219'
};
function auditActionLabel(a) { return AUDIT_ACTIONS[a] || a || '\u2014'; }
function auditTgError(raw) {
  var s = String(raw || '');
  var l = s.toLowerCase();
  if (l.indexOf('chat not found') >= 0) return '\u673A\u5668\u4EBA\u627E\u4E0D\u5230\u8BE5\u4F1A\u8BDD\uFF08\u8BF7\u5148\u7ED9\u673A\u5668\u4EBA\u53D1\u9001 /start\uFF0C\u5E76\u6838\u5BF9 Chat ID\uFF09';
  if (l.indexOf('bot was blocked') >= 0) return '\u673A\u5668\u4EBA\u5DF2\u88AB\u8BE5\u8D26\u53F7\u5C4F\u853D';
  if (l.indexOf('unauthorized') >= 0) return 'Bot Token \u65E0\u6548';
  if (l.indexOf('not enough rights') >= 0) return '\u673A\u5668\u4EBA\u6CA1\u6709\u53D1\u8A00\u6743\u9650';
  if (l.indexOf('not configured') >= 0) return '\u672A\u914D\u7F6E Telegram \u53D8\u91CF';
  return s;
}
function auditDetailText(l) {
  var a = l.action || '';
  var d = String(l.detail == null ? '' : l.detail);
  if (a === 'settings') {
    if (!d) return '\u2014';
    return d.split(',').filter(Boolean).map(function(k) { return AUDIT_SETTINGS[k] || k; }).join('\u3001');
  }
  if (a === 'report.send') {
    if (d === 'ok') return '\u53D1\u9001\u6210\u529F';
    if (d.indexOf('fail:') === 0) return '\u53D1\u9001\u5931\u8D25\uFF1A' + auditTgError(d.slice(5).trim());
    return d || '\u2014';
  }
  if (a === 'import') {
    var names = { routes: '\u8DEF\u7531', domains: '\u57DF\u540D', skipped: '\u8DF3\u8FC7' };
    return d.split(' ').filter(Boolean).map(function(p) {
      var i = p.indexOf('=');
      if (i < 0) return p;
      var k = p.slice(0, i), v = p.slice(i + 1);
      return (names[k] || k) + ' ' + v;
    }).join('\u3001') || '\u2014';
  }
  if (a === 'domain.delete') return d.replace('id=', 'ID ');
  if (a === 'user.update' || a === 'user.delete' || a === 'user.password') return d.replace('->', '\u2192');
  return d || '\u2014';
}
async function loadAudit() {
  if (!IS_ADMIN) return;
  const el = document.getElementById('auditList');
  const r = await fetch('/admin/api/audit');
  const d = await r.json();
  if (!d.logs || !d.logs.length) { el.textContent = '\u6682\u65E0\u8BB0\u5F55'; return; }
  el.innerHTML = '<table><thead><tr><th>\u65F6\u95F4</th><th>\u64CD\u4F5C</th><th>\u8BE6\u60C5</th></tr></thead><tbody>' + d.logs.map(function(l) {
    return '<tr><td>' + esc(new Date(l.ts).toLocaleString('zh-CN')) + '</td>'
      + '<td title="' + esc(l.action) + '">' + esc(auditActionLabel(l.action)) + '</td>'
      + '<td>' + esc(auditDetailText(l)) + '</td></tr>';
  }).join('') + '</tbody></table>';
}

async function loadDomains() {
  if (!IS_ADMIN) return;
  try {
    const r = await fetch('/admin/api/optimized-domains');
    if (r.status === 401) { location.href = '/admin'; return; }
    const d = await r.json();
    if (d.success) { allDomains = d.domains; renderDomains(allDomains); }
    else { document.getElementById('domainList').innerHTML = '<p class="muted">\u52A0\u8F7D\u5931\u8D25</p>'; }
  } catch (e) {
    document.getElementById('domainList').innerHTML = '<p class="muted">\u52A0\u8F7D\u5931\u8D25: ' + esc(e.message) + '</p>';
  }
}

function renderDomains(list, speedResults, best) {
  const el = document.getElementById('domainList');
  if (!list.length) { el.innerHTML = '<div class="empty-state"><span class="empty-state-icon">\u{1F310}</span><p class="empty-state-text">\u6682\u65E0\u4F18\u9009\u57DF\u540D</p></div>'; return; }
  const speedMap = {};
  if (speedResults) speedResults.forEach(function(r) { speedMap[r.domain] = r; });
  const sorted = list.slice().sort(function(a, b) {
    const sa = speedMap[a.domain], sb = speedMap[b.domain];
    const la = sa && sa.latency >= 0 ? sa.latency : Infinity;
    const lb = sb && sb.latency >= 0 ? sb.latency : Infinity;
    return la - lb;
  });
  let html = '<table><thead><tr><th>\u540D\u79F0</th><th>\u57DF\u540D</th><th>\u5EF6\u8FDF</th><th>\u72B6\u6001</th><th>\u64CD\u4F5C</th></tr></thead><tbody>';
  sorted.forEach(function(d) {
    const sr = speedMap[d.domain];
    const latency = sr && sr.latency >= 0 ? sr.latency + 'ms' : (sr ? '\u8D85\u65F6' : '\u2014');
    const pct = sr && sr.latency >= 0 ? Math.max(5, Math.min(100, Math.round(sr.latency / 3))) : 0;
    const statusClass = sr ? (sr.latency >= 0 ? (sr.latency < 100 ? 'tag-fast' : sr.latency < 300 ? 'tag-good' : 'tag-slow') : 'tag-timeout') : '';
    const statusText = sr ? (sr.latency >= 0 ? (sr.latency < 100 ? '\u6781\u5FEB' : sr.latency < 300 ? '\u826F\u597D' : '\u8F83\u6162') : '\u8D85\u65F6') : '';
    const isBest = best && best.domain === d.domain;
    html += '<tr' + (isBest ? ' class="best"' : '') + '>' +
      '<td>' + esc(d.name) + (d.isBuiltin ? ' <span class="tag tag-builtin">\u5185\u7F6E</span>' : '') + (isBest ? ' <span class="tag tag-best">BEST</span>' : '') + '</td>' +
      '<td><code>' + esc(d.domain) + '</code></td>' +
      '<td><div class="lat"><div class="lat-bar"><i style="width:' + pct + '%"></i></div><span>' + latency + '</span></div></td>' +
      '<td>' + (statusText ? '<span class="tag ' + statusClass + '">' + statusText + '</span>' : '\u2014') + '</td>' +
      '<td>' + (!d.isBuiltin ? '<button class="btn btn-sm" onclick="editDomain(' + d.id + ')">\u7F16\u8F91</button> <button class="btn btn-sm btn-danger" onclick="delDomain(' + d.id + ')">\u5220\u9664</button>' : '') + '</td>' +
    '</tr>';
  });
  html += '</tbody></table>';
  el.innerHTML = html;
}

function openDomainModal() {
  document.getElementById('domainId').value = '';
  document.getElementById('domainName').value = '';
  document.getElementById('domainUrl').value = '';
  document.getElementById('domainModalTitle').textContent = '\u6DFB\u52A0\u4F18\u9009\u57DF\u540D';
  openModal('modalDomain');
}

function editDomain(id) {
  const d = allDomains.find(function(x) { return x.id === id; });
  if (!d) return;
  document.getElementById('domainId').value = d.id;
  document.getElementById('domainName').value = d.name;
  document.getElementById('domainUrl').value = 'https://' + d.domain;
  document.getElementById('domainModalTitle').textContent = '\u7F16\u8F91\u4F18\u9009\u57DF\u540D';
  openModal('modalDomain');
}

async function saveDomain() {
  const id = document.getElementById('domainId').value;
  const name = document.getElementById('domainName').value.trim();
  const url = document.getElementById('domainUrl').value.trim();
  if (!name) { showToast('\u8BF7\u8F93\u5165\u540D\u79F0'); return; }
  if (!url) { showToast('\u8BF7\u8F93\u5165\u57DF\u540D'); return; }
  const domain = url.replace('https://', '').replace('http://', '').split('/')[0];
  const r = await fetch(id ? '/admin/api/optimized-domains/' + id : '/admin/api/optimized-domains', {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain: domain, name: name })
  });
  const d = await r.json();
  if (!d.success) { showToast(d.error || '\u4FDD\u5B58\u5931\u8D25'); return; }
  closeModal('modalDomain');
  showToast('\u4FDD\u5B58\u6210\u529F');
  loadDomains();
}

async function delDomain(id) {
  if (!confirm('\u786E\u5B9A\u5220\u9664\u6B64\u4F18\u9009\u57DF\u540D\uFF1F')) return;
  const r = await fetch('/admin/api/optimized-domains/' + id, { method: 'DELETE' });
  const d = await r.json();
  showToast(d.success ? '\u5DF2\u5220\u9664' : (d.error || '\u5220\u9664\u5931\u8D25'));
  if (d.success) loadDomains();
}

${SPEED_TOOLS}

async function testDomains() {
  var st = document.getElementById('domain-status');
  if (st) st.textContent = '\u5728\u672C\u673A\u6D4F\u89C8\u5668\u6D4B\u901F\u4E2D...';
  const rows = await speedTestDomains(allDomains, function(d, n) { if (st) st.textContent = '\u6D4B\u901F\u4E2D ' + d + '/' + n; });
  const best = rows.find(function(r) { return r.latency >= 0; }) || null;
  bestDomain = best;
  if (st) st.textContent = best ? '\u6700\u4F18: ' + best.domain + '\uFF08' + best.latency + 'ms\uFF0C\u672C\u673A\u6D4B\u5F97\uFF09' : '\u65E0\u53EF\u7528\u57DF\u540D';
  renderDomains(allDomains, rows, best);
}

async function loadQuickDNS() {
  if (!IS_ADMIN) return;
  var meta = document.getElementById('dnsQuickMeta');
  if (meta) meta.textContent = 'DNS \u8BB0\u5F55\u52A0\u8F7D\u4E2D...';
  try {
    const r = await fetch('/admin/api/dns-config');
    if (r.status === 401) { location.href = '/admin'; return; }
    const d = await r.json();
    if (!d.success) throw new Error('\u52A0\u8F7D\u5931\u8D25');
    quickDns = d;
    const rec = d.liveRecord;
    const nameEl = document.getElementById('dnsQuickName');
    const targetEl = document.getElementById('dnsQuickTarget');
    if (rec) {
      var full = rec.name || '';
      var root = d.baseDomain || '';
      var short = (root && full.endsWith('.' + root)) ? full.slice(0, full.length - root.length - 1) : full;
      nameEl.value = short;
      targetEl.value = rec.content || '';
      meta.textContent = '\u2705 [' + rec.type + '] ' + rec.name + ' \u2192 ' + rec.content + (rec.proxied ? '\uFF08\u5DF2\u4EE3\u7406\uFF09' : '\uFF08\u4EC5 DNS\uFF09') + (rec.modifiedOn ? ' \xB7 ' + rec.modifiedOn : '');
    } else {
      nameEl.value = d.resolvedName || '';
      targetEl.value = (d.config && d.config.currentDomain) || '';
      meta.textContent = (d.zonesError ? '\u26A0\uFE0F ' + d.zonesError : '\u672A\u5728 Cloudflare \u627E\u5230\u8BE5\u8BB0\u5F55\uFF0C\u586B\u5199\u76EE\u6807\u540E\u70B9\u4FDD\u5B58\u5373\u53EF\u521B\u5EFA');
    }
  } catch (e) {
    if (meta) meta.textContent = 'DNS \u52A0\u8F7D\u5931\u8D25: ' + (e.message || e);
  }
}

async function quickSaveDNS(btn) {
  if (!IS_ADMIN) return;
  const dnsName = document.getElementById('dnsQuickName').value.trim();
  const targetDomain = document.getElementById('dnsQuickTarget').value.trim();
  if (!targetDomain) { showToast('\u8BF7\u8F93\u5165\u76EE\u6807\u57DF\u540D\u6216 IP'); return; }
  btn.disabled = true; btn.textContent = '\u4FDD\u5B58\u4E2D...';
  try {
    const r = await fetch('/admin/api/dns/replace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zoneId: (quickDns && quickDns.zoneId) || '', dnsName: dnsName, targetDomain: targetDomain })
    });
    const d = await r.json();
    if (d.success) {
      const rec = d.result || {};
      showToast('\u2705 [' + (rec.type || 'CNAME') + '] ' + (rec.name || dnsName) + ' \u2192 ' + (rec.content || targetDomain));
      loadQuickDNS();
    } else {
      showToast('\u274C ' + (d.error || d.errors?.[0]?.message || '\u4FDD\u5B58\u5931\u8D25'));
    }
  } catch (e) {
    showToast('\u274C \u8BF7\u6C42\u5931\u8D25: ' + e.message);
  }
  btn.disabled = false; btn.textContent = '\u4FDD\u5B58';
}

async function sendReport(btn) {
  if (btn) { btn.disabled = true; btn.textContent = '\u53D1\u9001\u4E2D...'; }
  try {
    const r = await fetch('/admin/api/report/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const d = await r.json().catch(function() { return {}; });
    if (d.success) showToast('\u2705 \u65E5\u62A5\u5DF2\u53D1\u9001' + (d.webhook && d.webhook.ok ? '\uFF08Telegram + Webhook\uFF09' : '\uFF08Telegram\uFF09'));
    else { showToast('\u274C ' + (d.hint || (d.telegram && d.telegram.error) || '\u53D1\u9001\u5931\u8D25'), 9000); loadAudit(); }
  } catch (e) {
    showToast('\u274C \u53D1\u9001\u5931\u8D25: ' + e.message);
  }
  if (btn) { btn.disabled = false; btn.textContent = '\u53D1\u9001\u65E5\u62A5'; }
}

document.getElementById('routePrefix').addEventListener('input', function() {
  document.getElementById('prefixPreview').textContent = this.value.trim() || 'myemby';
});

loadRoutes();
loadStats();
if (IS_ADMIN) {
  loadQuickDNS();
  loadDomains();
  loadUsers();
  loadInvites();
} else {
  loadUserEntry();
}
<\/script></body></html>`;
}
__name(buildAdminHtml, "buildAdminHtml");
async function runHealthCheck(env2, manual = false) {
  if (!env2.DB) return { checked: 0, alerts: [] };
  const { results: routes } = await env2.DB.prepare("SELECT prefix, target, remark FROM routes WHERE enabled != 0").all();
  let userRoutes = [];
  try {
    const res = await env2.DB.prepare("SELECT owner, prefix, target, remark FROM user_routes WHERE enabled != 0").all();
    userRoutes = (res.results || []).map((r) => ({
      prefix: r.owner + "/" + r.prefix,
      target: r.target,
      remark: (r.remark ? r.remark + " " : "") + "(@" + r.owner + ")"
    }));
  } catch (_) {
  }
  const { results: states } = await env2.DB.prepare("SELECT * FROM route_health").all();
  const stateMap = new Map((states || []).map((r) => [r.prefix + "|" + r.target, r]));
  const jobs = [];
  for (const r of [...routes || [], ...userRoutes]) {
    for (const t of splitTargets(r.target)) jobs.push({ r, t });
  }
  const limited = jobs.slice(0, 40);
  const probes = await Promise.all(limited.map(async (j) => ({ ...j, res: await probeTarget(j.t) })));
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const stmts = [];
  const alerts = [];
  for (const { r, t, res } of probes) {
    const prev = stateMap.get(r.prefix + "|" + t);
    const fail = res.ok ? 0 : (prev?.fail_count || 0) + 1;
    const down = res.ok ? 0 : fail >= 2 ? 1 : prev?.down || 0;
    const changed = (prev?.down || 0) !== down;
    if (changed) alerts.push(`${down ? "\u{1F534} \u7EBF\u8DEF\u5F02\u5E38" : "\u{1F7E2} \u7EBF\u8DEF\u6062\u590D"}\uFF1A/${r.prefix}${r.remark ? "\uFF08" + r.remark + "\uFF09" : ""}
${t}${res.ok ? "" : "\n" + (res.error || "HTTP " + res.status)}`);
    stmts.push(env2.DB.prepare(
      `INSERT INTO route_health (prefix, target, down, fail_count, latency, last_check, last_change) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(prefix, target) DO UPDATE SET down = excluded.down, fail_count = excluded.fail_count, latency = excluded.latency,
         last_check = excluded.last_check, last_change = CASE WHEN route_health.down != excluded.down THEN excluded.last_check ELSE route_health.last_change END`
    ).bind(r.prefix, t, down, fail, res.ms, nowIso, nowIso));
  }
  if (stmts.length) await env2.DB.batch(stmts);
  if (alerts.length) await notify(env2, alerts.join("\n\n"));
  return { checked: probes.length, alerts };
}
__name(runHealthCheck, "runHealthCheck");
async function runScheduled(env2) {
  if (!env2.DB) return;
  await initDatabase(env2);
  const st = await getSettings(env2);
  if (st.healthCheck) {
    try {
      await runHealthCheck(env2);
    } catch (_) {
    }
  }
  const now = getShanghaiParts();
  const reportEnabled = String(st.raw.tg_daily_report ?? "1") !== "0";
  if (reportEnabled && now.hour === 23) {
    try {
      if (await claimReportSlot(env2, now.dateKey)) await sendDailyReport(env2, now.dateKey);
    } catch (_) {
    }
  }
}
__name(runScheduled, "runScheduled");
var worker_default = {
  async scheduled(event, env2, ctx) {
    ctx.waitUntil(runScheduled(env2));
  },
  async fetch(request, env2, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Max-Age": "86400"
        }
      });
    }
    if (env2.DB) {
      try {
        await initDatabase(env2);
      } catch (_) {
      }
    }
    if (url.pathname === "/") return html(buildFrontendHtml(env2));
    if (url.pathname === "/favicon.ico") return new Response("", { headers: { "Content-Type": "image/x-icon" } });
    if (url.pathname.startsWith("/cdn-cgi/")) return new Response("Not Found", { status: 404 });
    if (url.pathname === "/health") {
      return json({ status: "ok", version: CURRENT_VERSION, colo: request.cf?.colo, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
    }
    if (url.pathname === "/stats") {
      const dateParam = url.searchParams.get("date") || "";
      return cachedJson(request, "stats:" + dateParam, 60, () => handleStatsRequest(env2, url));
    }
    if (url.pathname === "/api/edge-info") return json(await getEdgeInfo(request));
    if (url.pathname === "/api/domains/list") {
      if (!env2.DB) {
        return json({ success: true, domains: DEFAULT_OPTIMIZED_DOMAINS.map((d, i) => ({ id: i, ...d })) });
      }
      const domains = await getOptimizedDomains(env2);
      return json({ success: true, domains });
    }
    if (url.pathname === "/api/config/dns-record-name") {
      const base = getBaseDomain(env2);
      return json({ dnsRecordName: getDnsRecordName(env2) || (base ? base.split(".")[0] : "emby") });
    }
    if (url.pathname === "/api/config/base-domain") {
      return json({ baseDomain: getBaseDomain(env2) || "yourdomain.com" });
    }
    if (url.pathname === "/admin/api/login" && request.method === "POST") {
      try {
        const body = await readJson(request) || {};
        return adminLoginResponse(request, env2, body);
      } catch (e) {
        return json({ ok: false, error: e.message }, 400);
      }
    }
    if (url.pathname === "/api/register" && request.method === "POST") {
      try {
        return await handleRegister(request, env2);
      } catch (e) {
        return json({ ok: false, error: "\u6CE8\u518C\u5931\u8D25: " + String(e?.message || e).slice(0, 160) }, 500);
      }
    }
    if (url.pathname === "/api/logout" && request.method === "POST") return logoutResponse();
    if (url.pathname === "/register" || url.pathname === "/register/") {
      const res = html(buildRegisterHtml(env2));
      res.headers.set("X-Robots-Tag", "noindex, nofollow");
      return res;
    }
    if (url.pathname === "/login") {
      return Response.redirect(url.origin + "/admin", 302);
    }
    if (url.pathname === "/robots.txt") {
      return new Response("User-agent: *\nDisallow: /\n", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
    if (url.pathname === "/admin" || url.pathname === "/admin/") {
      const session = await getSession(request, env2);
      const page = session ? buildAdminHtml(session, env2) : buildLoginHtml();
      const res = html(page);
      res.headers.set("X-Robots-Tag", "noindex, nofollow");
      return res;
    }
    if (url.pathname.startsWith("/admin/api/")) {
      const session = await getSession(request, env2);
      if (!session || !session.isAdmin) return new Response("Unauthorized", { status: 401 });
      if (!env2.DB) return json({ error: "DB \u672A\u7ED1\u5B9A" }, 500);
      try {
        return await handleAdminApi(request, env2, url, session);
      } catch (e) {
        return json({ error: "\u670D\u52A1\u5668\u5185\u90E8\u9519\u8BEF: " + String(e?.message || e).slice(0, 200) }, 500);
      }
    }
    if (url.pathname.startsWith("/api/user/")) {
      if (!env2.DB) return json({ error: "DB \u672A\u7ED1\u5B9A" }, 500);
      const session = await getSession(request, env2);
      if (!session) return json({ error: "Unauthorized" }, 401);
      try {
        return await handleUserApi(request, env2, url, session);
      } catch (e) {
        return json({ error: "\u670D\u52A1\u5668\u5185\u90E8\u9519\u8BEF: " + String(e?.message || e).slice(0, 200) }, 500);
      }
    }
    const pathFirst = url.pathname.split("/").filter(Boolean)[0]?.toLowerCase();
    const looksLikeFileName = /\.(?:txt|html?|xml|json|ico|png|jpe?g|gif|svg|webp|css|js|map|php|aspx?|env|git)$/i.test(pathFirst || "");
    const looksLikeDirectUrl = url.pathname.startsWith("/http://") || url.pathname.startsWith("/https://") || pathFirst && !looksLikeFileName && (pathFirst.includes(".") || pathFirst.includes(":"));
    if (looksLikeDirectUrl) {
      let path = url.pathname.substring(1);
      if (path.startsWith("/")) return new Response("Invalid proxy format", { status: 400 });
      path = path.replace(/^(https?)\/(?!\/)/, "$1://");
      if (!path.startsWith("http")) path = "https://" + path;
      try {
        const upstreamUrl = new URL(path);
        if (upstreamUrl.protocol !== "http:" && upstreamUrl.protocol !== "https:") {
          return new Response("Invalid URL format", { status: 400 });
        }
        if (!directProxyAllowed(env2, upstreamUrl.hostname)) {
          return new Response("Forbidden: direct proxy target not allowed", { status: 403 });
        }
        upstreamUrl.search = url.search;
        return proxyDirectUrl(request, env2, ctx, [upstreamUrl.toString()], { enableCache: true });
      } catch {
        return new Response("Invalid URL format", { status: 400 });
      }
    }
    if (!env2.DB) {
      return new Response("D1 \u6570\u636E\u5E93\u672A\u7ED1\u5B9A\uFF0C\u8DEF\u7531\u53CD\u4EE3\u4E0D\u53EF\u7528\u3002\u4ECD\u53EF\u4F7F\u7528 /https://... \u683C\u5F0F\u3002", { status: 500 });
    }
    const resolved = await resolveProxyTarget(request, env2, url);
    if (resolved.error) return resolved.error;
    return proxyDirectUrl(request, env2, ctx, resolved.upstreamUrls, {
      enableCache: resolved.enableCache,
      compatMode: resolved.compatMode,
      clientIpMode: resolved.clientIpMode,
      matchedPrefix: resolved.matchedPrefix,
      statPrefix: resolved.statPrefix,
      routeOwner: resolved.routeOwner,
      legacyUserId: resolved.legacyUserId,
      customHeaders: resolved.customHeaders
    });
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
