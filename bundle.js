// src/lib/core.js
var Log = console.log;
var UN = void 0;
var Void = () => {
};
var K = (v) => () => v;
var V = (v) => (f) => f(v);
var Do = (f) => f();
var Pipe = (...fns) => (v) => fns.reduce((r, g) => g(r), v);
var Flow = (v, ...fns) => Pipe(...fns)(v);
var OnUN = (v, getV) => v === UN ? getV() : v;
var Mutable = (v) => ObjectFreeze({
  get: () => v,
  set: (v2) => v = v2
});
var MapMutable = (m, map) => {
  const skip = Symbol("skip");
  const v = map(m.get(), skip);
  if (v === skip) return;
  m.set(v);
};
var Inc = (n) => n + 1;
var Dec = (n) => n - 1;
var WithArgs = (f) => (...args) => (a) => f(a, ...args);
var IncMutable = WithArgs(MapMutable)(Inc);
var DecMutable = WithArgs(MapMutable)(Dec);
var ObjectSet = (o, k, v) => o[k] = v;
var ObjectFreeze = Object.freeze;
var ObjectOmit = (o, keys, mutate = false) => {
  const _obj = mutate ? o : { ...o };
  for (const k of keys) {
    delete _obj[k];
  }
  return _obj;
};
var ObjectPick = (o, keys, mutate = false) => ObjectOmit(
  o,
  new Set(Object.keys(o)).difference(new Set(keys)).values(),
  mutate
);
var ObjectMapEntries = (o, map) => Object.fromEntries(Object.entries(o).map(map));
var Signal = (v, f = Void, useSet = Void) => {
  const value = Mutable(v), event = Mutable(f);
  const sig = ObjectFreeze({
    get: value.get,
    set: (v2) => {
      value.set(v2);
      const _event = event.get();
      if (typeof _event === "function") _event(v2);
      else if (typeof _event.f === "function") _event.f((_) => _event.data, v2);
      else Emit(_event, v2);
    },
    event
  });
  useSet(sig.set);
  return sig;
};
var Emit = (emittable, v) => {
  if (typeof emittable === "function") emittable(v);
  else if (Array.isArray(emittable) || emittable instanceof Set || emittable instanceof Map) {
    emittable.forEach(V(v));
  } else if (typeof emittable === "object" && emittable !== null) {
    Emit(Object.values(emittable), v);
  } else {
    return new Error("Emit: data must be an iterable, function, or an object");
  }
};

// src/lib/dom.js
var Ele = (tag) => document.createElement(tag);
var Comment = (s) => document.createComment(s);
var svg_namespace = "http://www.w3.org/2000/svg";
var SVG = (tag) => document.createElementNS(svg_namespace, tag);
var to_kebab_case = (s) => s.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
var DROP = Symbol("DROP");
var get_set_sig_fn = (set_fn) => (el, k, set_listener) => set_listener((v) => set_fn(el, k, v));
var get_set_multi_fn = (set_fn) => {
  const set_sig = get_set_sig_fn(set_fn);
  return [
    set_sig,
    Do(
      (set_multi) => set_multi = (el, data) => {
        if (typeof data === "function") data((d) => set_multi(el, d));
        else {
          Object.entries(data).forEach(
            ([k, v]) => (typeof v === "function" ? set_sig : set_fn)(el, k, v)
          );
        }
      }
    )
  ];
};
var GetStyles = (styles) => ObjectMapEntries(styles, ([k, v]) => [to_kebab_case(k), v]);
var StyleToString = (k, v) => `${k}: ${v};`;
var StylesToString = (styles) => Object.entries(styles).map(([k, v]) => StyleToString(k, v)).join("");
var StyleSheet = (styles) => Object.entries(styles).map(([k, v]) => `${k} { ${StylesToString(GetStyles(v))} }`).join("");
var SetStyle = (el, k, v) => v === DROP ? el.style.removeProperty(to_kebab_case(k)) : el.style.setProperty(to_kebab_case(k), v);
var SetAttr = (el, k, v) => v === DROP ? el.removeAttribute(k) : typeof v === "boolean" ? SetAttr(el, k, v ? "" : DROP) : el.setAttribute(k, v);
var SetProp = ObjectSet;
var [SetStyleSig, SetStyles] = get_set_multi_fn(SetStyle);
var [SetAttrSig, SetAttrs] = get_set_multi_fn(SetAttr);
var [SetPropSig, SetProps] = get_set_multi_fn(SetProp);
var PushEvent = (el, name, fn, options) => el.addEventListener(name, fn, options);
var PushEvents = (el, events) => Object.entries(events).forEach(([name, fn_or_o]) => {
  typeof fn_or_o === "function" ? PushEvent(el, name, fn_or_o) : PushEvent(el, name, fn_or_o.fn, fn_or_o.options);
});
var _getActionList = (options) => Object.keys(
  ObjectPick(options, [
    "styles",
    "attributes",
    "properties",
    "events",
    "children",
    "useRef"
  ])
);
var _getActionMap = (options) => ({
  styles: () => SetStyles(options.el, options.styles),
  attributes: () => SetAttrs(options.el, options.attributes),
  properties: () => SetProps(options.el, options.properties),
  events: () => PushEvents(options.el, options.events),
  children: () => options.el.append(
    ...Flow(
      options.children,
      (arr) => Array.isArray(arr) ? arr : [arr]
    ).map(H)
  ),
  useRef: () => {
    const _options = options.useRef(options.el);
    if (_options !== UN)
      H({
        ..._options,
        el: options.el
      });
  }
});
var H = (options) => {
  if (typeof options === "string") return options;
  if (typeof options.comment === "string") {
    return Comment(options.comment);
  }
  if (options.el === UN) {
    options.el = options.isSvg ? SVG(OnUN(options.tag, K("svg"))) : Ele(OnUN(options.tag, K("div")));
  }
  const actions = _getActionList(options);
  const actionMap = _getActionMap(options);
  actions.forEach((k) => actionMap[k]());
  return options.el;
};

// src/apps/todo5.js
var Quad = ({
  all = "0px",
  horizontal = all,
  vertical = all,
  left = horizontal,
  right = horizontal,
  top = vertical,
  bottom = vertical
} = {}) => `${top} ${right} ${bottom} ${left}`;
var BoxShadow = ({
  x = 0,
  y = 0,
  blur = 0,
  spread = 0,
  color = "black"
} = {}) => `${x}px ${y}px ${blur}px ${spread}px ${color}`;
var App = (_) => {
  const appState = {};
  appState.bottomBttnSize = 50;
  appState.tasklistRef = Mutable();
  appState.pushTaskEl = (el) => appState.tasklistRef.get().appendChild(el);
  appState.dropTaskEl = (el) => appState.tasklistRef.get().removeChild(el);
  appState.focusedTask = Mutable();
  appState.$isTaskFocused = Signal(false, []);
  appState.setEditDoneBttnVisibility = (set) => {
    const $ = Signal(appState.$isTaskFocused.get(), []);
    const f = (isFocused) => isFocused ? set(DROP) : set("hidden");
    appState.$isTaskFocused.event.get().push(f);
    set(f($.get()));
    return $;
  };
  appState.setDeleteBttnVisibility = appState.setEditDoneBttnVisibility;
  appState.userActions = {
    newTaskBttnClick: (_2) => {
      Log("Todo: create a empty task and add it to list");
      const task = Components.Task();
      appState.pushTaskEl(task.el);
    },
    editDoneBttnClick: Void,
    deleteBttnClick: Void
  };
  H({
    el: document.body,
    styles: {
      backgroundColor: "hsl(0 0% 100% / 1)",
      // corrections
      margin: "0px",
      padding: "0px",
      overflow: "hidden",
      overscrollBehavior: "none",
      width: "100%",
      height: "100%",
      boxSizing: "border-box"
    },
    children: {
      tag: "style",
      properties: {
        innerText: StyleSheet({
          ":fullscreen::backdrop": {
            display: "none"
          }
        })
      }
    }
  });
  const Components = {};
  Components.Task = () => {
    const taskState = {};
    taskState.ref = Mutable();
    taskState.$scrollHeight = Signal();
    taskState.useRef = (taskRef) => {
      taskState.ref.set(taskRef);
    };
    taskState.deleteItem = (_2) => {
      taskState.ref.get().remove();
      appState.widthResizeObserver.unobserve(taskState.ref.get());
    };
    taskState.updateHeight = (_2) => {
      taskState.$scrollHeight.set(0);
      const scrollHeight = taskState.ref.get().scrollHeight;
      taskState.$scrollHeight.set(scrollHeight);
    };
    taskState.styles = {
      height: (set) => {
        taskState.$scrollHeight.event.set((height) => set(`${height}px`));
        queueMicrotask((_2) => {
          set("0px");
          const taskRef = taskState.ref.get();
          H({
            el: taskRef,
            properties: {
              value: ""
            }
          });
          const scrollHeight = taskRef.scrollHeight;
          taskState.$scrollHeight.set(scrollHeight);
        });
      }
    };
    taskState.events = {
      input: (ev) => {
        taskState.updateHeight();
      },
      focus: (_2) => {
        Log("focus", taskState.ref.get());
        appState.focusedTask.set(taskState.ref.get());
        MapMutable(
          appState.$isTaskFocused,
          (isFocused, skip) => isFocused ? skip : true
        );
      },
      blur: (_2) => {
        Log("blur", taskState.ref.get());
        setTimeout((_3) => {
          if (appState.focusedTask.get() === taskState.ref.get()) {
            appState.focusedTask.set();
            appState.$isTaskFocused.set(false);
          }
        }, 0);
      }
    };
    taskState.windowResizeListener = (ev) => {
      taskState.updateHeight();
    };
    window.addEventListener("resize", taskState.windowResizeListener);
    const opts = {
      styles: {
        padding: "5px",
        outline: "1px solid",
        borderRadius: "14px"
      },
      children: {
        tag: "textarea",
        useRef: taskState.useRef,
        styles: {
          width: "100%",
          padding: "0px",
          resize: "none",
          overflow: "hidden",
          border: "none",
          outline: "none",
          ...taskState.styles
        },
        events: taskState.events
      }
    };
    return {
      el: H(opts),
      updateHeight: taskState.updateHeight,
      cleanup: (_2) => {
        window.removeEventListener("resize", taskState.windowResizeListener);
      }
    };
  };
  Components.taskList = {
    styles: {
      height: "100%",
      width: "100%",
      padding: Quad({
        top: "10px",
        bottom: `${50 + 10 * 2 + 10}px`,
        horizontal: "10px"
      }),
      boxSizing: "border-box",
      overflowX: "hidden",
      overflowY: "auto",
      scrollBehavior: "smooth",
      overscrollBehavior: "none",
      display: "flex",
      flexDirection: "column",
      gap: "10px"
    },
    useRef: appState.tasklistRef.set
  };
  Components.actionBar = {
    attributes: {
      class: "add-bttn-bar"
    },
    styles: {
      position: "absolute",
      bottom: "0px",
      width: "100%",
      padding: Quad({ vertical: "10px" }),
      boxSizing: "border-box"
    },
    children: [
      {
        // bar bg
        styles: {
          overflow: "hidden",
          position: "absolute",
          width: "100%",
          height: "100%",
          zIndex: 0,
          bottom: "0px"
        },
        children: {
          styles: {
            position: "absolute",
            height: "100%",
            width: "100%",
            transform: "scale(1.5)",
            backdropFilter: "blur(3px)",
            backgroundColor: "hsl(0deg 0% 68.65% / 12.16%)"
          }
        }
      },
      {
        // buttons
        styles: {
          zIndex: 1,
          height: "100%",
          width: "100%",
          display: "flex",
          justifyContent: "space-evenly",
          alignItems: "center",
          position: "relative"
        },
        children: [
          {
            // edit done bttn
            styles: {
              width: `${appState.bottomBttnSize}px`,
              height: `${appState.bottomBttnSize}px`,
              borderRadius: "10px",
              border: `1px solid black`,
              visibility: appState.setEditDoneBttnVisibility
            },
            events: {
              click: appState.userActions.editDoneBttnClick
            }
          },
          {
            // add bttn
            properties: {
              innerText: "+"
            },
            styles: {
              width: `${appState.bottomBttnSize}px`,
              height: `${appState.bottomBttnSize}px`,
              borderRadius: "50%",
              backgroundColor: "#181818",
              backgroundImage: "linear-gradient(135deg, hsl(0deg 0% 100% / 20%), transparent)",
              boxShadow: BoxShadow({
                blur: 4,
                x: 1,
                y: 1
              }),
              display: "flex",
              flexWrap: "wrap",
              alignContent: "center",
              justifyContent: "center",
              fontSize: "xx-large",
              color: "hsl(0deg 0% 80%)",
              userSelect: "none"
            },
            events: {
              click: appState.userActions.newTaskBttnClick
            }
          },
          {
            // delete bttn
            styles: {
              width: `${appState.bottomBttnSize}px`,
              height: `${appState.bottomBttnSize}px`,
              borderRadius: "10px",
              border: `1px solid black`,
              visibility: appState.setDeleteBttnVisibility
            },
            events: {
              click: appState.userActions.deleteBttnClick
            }
          }
        ]
      }
    ]
  };
  H({
    el: document.getElementById("root"),
    styles: {
      height: "100%",
      width: "100%",
      boxSizing: "border-box"
    },
    children: [Components.taskList, Components.actionBar]
  });
};
var appData = {
  name: "ToDo"
};
var appInit = {
  title: appData.name
};

// src/main.js
App();
