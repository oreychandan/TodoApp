// src/lib/core.js
var UN = void 0;
var Void = () => {
};
var I = (v) => v;
var K = (v) => () => v;
var E = (f, returnF = false) => (v) => (f(v), returnF ? f : v);
var V = (v) => (f) => f(v);
var Do = (f) => f();
var Pipe = (...fns) => (v) => fns.reduce((r, g) => g(r), v);
var Flow = (v, ...fns) => Pipe(...fns)(v);
var OnUN = (v, getV) => v === UN ? getV() : v;
var Lazy = (get = I) => {
  let _ = (a) => {
    const v = get(a);
    get = UN;
    _ = () => v;
    return v;
  };
  return (a) => _(a);
};
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
var Signal = (v, f = Void) => {
  const value = Mutable(v), event = Mutable(f);
  return ObjectFreeze({
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
var SetAttr = (el, k, v) => v === DROP ? el.removeAttribute(k) : el.setAttribute(k, v);
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
    "attrs",
    "props",
    "events",
    "children",
    "useRef"
  ])
);
var _getActionMap = (options) => ({
  styles: () => SetStyles(options.el, options.styles),
  attrs: () => SetAttrs(options.el, options.attrs),
  props: () => SetProps(options.el, options.props),
  events: () => PushEvents(options.el, options.events),
  children: () => options.el.append(
    ...Flow(
      options.children,
      (arr) => Array.isArray(arr) ? arr : [arr]
    ).map(H)
  ),
  useRef: () => options.useRef(options.el)
});
var H = (options) => {
  if (typeof options === "string") return options;
  if (typeof options.comment === "string") return Comment(options.comment);
  if (options.el === UN)
    options.el = options.isSvg ? SVG(OnUN(options.tag, K("svg"))) : Ele(OnUN(options.tag, K("div")));
  const actions = _getActionList(options);
  const actionMap = _getActionMap(options);
  actions.forEach((k) => actionMap[k]());
  return options.el;
};

// src/apps/todo1.js
var app = () => {
  const Logic = Do(() => {
    const showAddTaskButton$ = Signal(false, []);
    let init = true;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (init) init = false;
        else {
          if (entry.isIntersecting) {
            showAddTaskButton$.set(false);
          } else {
            showAddTaskButton$.set(true);
          }
        }
      });
    });
    const newTask$ = Signal(UN, []);
    return {
      showAddTaskButton$,
      newTask$,
      nextTask: UN,
      prevTask: UN,
      observer
    };
  });
  const newTask = (_) => {
    const isTask = Mutable(false);
    const content$ = Signal("", []);
    const hasContent$ = Signal(false, []);
    content$.event.get().push((content) => {
      hasContent$.set(content.length > 0);
    });
    hasContent$.event.get().push((hasContent) => {
      if (hasContent && !isTask.get()) {
        isTask.set(true);
        queueMicrotask((_2) => {
          Logic.newTask$.set();
        });
      }
    });
    const taskInputEventHandler = (e) => {
      content$.set(e.target.value);
    };
    const checkboxVisibility = (set) => hasContent$.event.get().push(
      E(
        (hasContent) => set(hasContent ? "visible" : "hidden"),
        true
      )(hasContent$.get())
    );
    const textbox = Lazy((ctx = {}) => ({
      setHeight: (set) => {
        content$.event.get().push((content) => {
          const lineCount = ctx.getLineCount();
          if (content === "") set("auto");
          else if (lineCount < 6) {
            set("auto");
            set(ctx.getScrollHeight());
          }
        });
      },
      useRef: (TaskContentRef) => {
        ctx.ref = TaskContentRef;
        ctx.getScrollHeight = () => TaskContentRef.scrollHeight;
        ctx.getLineCount = () => TaskContentRef.value.split("\n").length;
      },
      click: (_2) => {
        ctx.ref.parentNode.parentNode.removeChild(ctx.ref.parentNode);
      }
    }));
    return H({
      styles: {
        display: "flex",
        width: "100%",
        border: "1px solid var(--color-1)",
        borderRadius: "15px",
        padding: "5px",
        gap: "5px",
        boxSizing: "border-box"
      },
      children: [
        // <TaskDoneCheckbox />
        {
          styles: {
            height: "40px",
            width: "40px",
            borderRadius: "10px",
            border: "1px solid var(--color-1)",
            visibility: checkboxVisibility
          },
          events: {
            click: textbox().click
            // _ => {
            //   Core.Log('TaskDoneCheckbox clicked');
            // },
          }
        },
        // <TaskContent />
        {
          tag: "textarea",
          attrs: {
            type: "text",
            placeholder: "Enter task content here",
            // no autocorrect and such
            autocorrect: "off",
            autocapitalize: "off",
            autocomplete: "off",
            spellcheck: "false"
          },
          styles: {
            flexGrow: 1,
            padding: "5px",
            // border: '1px solid black',
            color: "var(--color-1)",
            fontFamily: "monospace",
            borderRadius: "5px",
            resize: "none",
            height: textbox().setHeight,
            backgroundColor: "transparent",
            border: "none",
            outline: "none"
            // overflow: set => clicked$.event.get().push(
            //   _ =>
            // )
          },
          events: {
            input: taskInputEventHandler
          },
          useRef: textbox().useRef
        }
      ],
      useRef: (TaskRef) => {
        Logic.observer.observe(TaskRef);
        if (Logic.nextTask !== UN) {
          Logic.observer.unobserve(Logic.nextTask);
        }
        Logic.prevTask = Logic.nextTask;
        Logic.nextTask = TaskRef;
      }
    });
  };
  H({
    el: document.body,
    styles: {
      backgroundColor: "white"
    }
  });
  H({
    el: document.body.querySelector("#root"),
    styles: {
      "--color-1": "blueviolet",
      backgroundColor: "white",
      height: "100vh",
      width: "100vw",
      boxSizing: "border-box",
      padding: "5px"
    },
    children: [
      // StyleSheet
      {
        tag: "style",
        attrs: {
          type: "text/css"
        },
        children: StyleSheet({
          "textarea::placeholder": {
            color: "var(--color-1)",
            fontFamily: "monospace",
            fontStyle: "italic",
            textDecorationLine: "underline",
            textDecorationStyle: "double"
          }
        })
      },
      // <TaskList />
      {
        styles: {
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          height: "100%",
          overflow: "scroll",
          scrollBehavior: "smooth",
          gap: "5px"
        },
        useRef: (TaskListRef) => {
          Logic.newTask$.event.get().push(
            E((_) => {
              TaskListRef.append(newTask());
            }, true)(Do)
          );
        }
      },
      // (showAddTaskButton && <NewTaskButton />)
      {
        styles: {
          height: "45px",
          width: "45px",
          border: "1px solid var(--color-1)",
          boxSizing: "border-box",
          borderRadius: "10px",
          visibility: (set) => {
            Logic.showAddTaskButton$.event.get().push((b) => {
              set(b ? "visible" : "hidden");
            });
          },
          position: "absolute",
          bottom: "10px",
          left: "calc(50% - 20px)",
          backgroundColor: "white",
          boxShadow: "0px 0px 4px 0px hsl(0deg 0% 0% / 50%)"
        },
        children: [
          {
            // vertical
            styles: {
              position: "absolute",
              top: "50%",
              left: "calc(50% - 2px)",
              width: "4px",
              height: "80%",
              backgroundColor: "var(--color-1)",
              borderRadius: "5px",
              transform: "translateY(-50%)"
            }
          },
          {
            // horizontal
            styles: {
              position: "absolute",
              top: "calc(50% - 2px)",
              left: "50%",
              height: "4px",
              width: "80%",
              backgroundColor: "var(--color-1)",
              borderRadius: "5px",
              transform: "translateX(-50%)"
            }
          }
        ]
      }
    ]
  });
};

// src/main.js
app();
