const utils = {
    getValue(expr, vm) {
        return vm.$data[expr.trim()]
    },
    setValue(expr, vm, newValue) {
        vm.$data[expr] = newValue
    },
    textUpdater(node, value) {
        node.textContent = value;
    },
    modelUpdater(node, value) {
        node.value = value;
    },
    model(node, value, vm) {
        //触发监听get()
        const initValue = this.getValue(value, vm);
        new Watcher(value, vm, (newValue) => {
            this.modelUpdater(node, newValue);
        });
        //v-model双向绑定
        node.addEventListener('input', (e) => {
            const newValue = e.target.value;
            //触发监听set()
            this.setValue(value, vm, newValue);
        });
        this.modelUpdater(node, initValue);
    },
    text(node, value, vm) {
        let result;
        //{{xx}}
        if (value.includes('{{')) {
            value.replace(/\{\{(.+)\}\}/g, (...args) => {
                const expr = args[1];
                new Watcher(expr, vm, (newValue) => {
                    this.textUpdater(node, newValue);
                });
                result = this.getValue(expr, vm);
            })
        } else {
            //v-text="xx"
            result = this.getValue(value, vm);
        }
        this.textUpdater(node, result);
    },
    on(node, value, vm, eventName) {
        const fn = vm.$options.methods[value];
        node.addEventListener(eventName, fn.bind(vm), false);
    }
}

class Observer {
    constructor(data) {
        this.observer(data);
    }
    observer(data) {
        if (data && typeof data === 'object') {
            Object.keys(data).forEach(key => {
                //递归处理
                this.defineReactive(data, key, data[key]);
            })
        }
    }
    defineReactive(obj, key, value) {
        const dep = new Dep();
        this.observer(value);
        Object.defineProperty(obj, key, {
            get() {
                //console.log("$data get", key, value);
                const target = Dep.target;
                target && dep.addWatcher(target);
                return value;
            },
            set: (newVal) => {
                if (value === newVal) return;
                // console.log("$data set", key, newVal);
                this.observer(newVal);
                value = newVal;
                dep.notify();

            }
        })
    }
}

//一个DOM节点的依赖与更新
class Watcher {
    constructor(expr, vm, callback) {
        this.expr = expr;
        this.vm = vm;
        this.callback = callback;
        //通过getter对数据进行绑定，标记当前的watcher
        this.oldValue = this.getOldValue();
    }
    getOldValue() {
        Dep.target = this;
        const oldValue = utils.getValue(this.expr, this.vm);
        Dep.target = null;
        return oldValue;

    }
    update() {
        const newValue = utils.getValue(this.expr, this.vm);
        if (newValue !== this.oldValue) {
            this.callback(newValue);
        }

    }
}

//一个数据多个Watcher依赖
class Dep {
    constructor() {
        this.collect = [];
    }
    addWatcher(wathcer) {
        this.collect.push(wathcer);
    }
    notify() {
        this.collect.forEach(w => w.update())
    }
}


//编译
class Compiler {
    constructor(el, vm) {
        this.el = this.isElementNode(el) ? el : document.querySelector(el);
        this.vm = vm;
        const fragment = this.compileFragment(this.el);
        this.compile(fragment);
        this.el.appendChild(fragment);

    }
    isElementNode(el) {
        return el.nodeType === 1;
    }
    isTextNode(el) {
        return el.nodeType === 3;
    }
    compileFragment(el) {
        const f = document.createDocumentFragment();
        let firstChild;
        // f.appendChild(firstChild)会删除插入的元素
        while (firstChild = el.firstChild) {
            f.appendChild(firstChild);
        }
        return f;
    }
    compile(fragment) {
        const childNodes = Array.from(fragment.childNodes);
        childNodes.forEach(childNode => {
            if (this.isElementNode(childNode)) {
                //标签节点 h1/input ,读取属性，看是否有v-开头的内容
                ///console.log("标签节点:", childNode);
                this.compileElement(childNode);
            } else if (this.isTextNode(childNode)) {
                //内容文本节点{{msg}},看是否有双括号语法
                //console.log("文本节点:", childNode);
                this.compileText(childNode)
            }
            //有子节点则递归
            if (childNode.childNodes && childNode.childNodes.length) {
                this.compile(childNode);
            }
        })
    }
    compileElement(node) {
        const attributes = Array.from(node.attributes);
        attributes.forEach(attr => {
            const { name, value } = attr;
            if (this.isDirector(name)) {
                //指令 v-model,v-text,v-bind,v-on:click
                const [, directive] = name.split('-');
                const [compileKey, eventName] = directive.split(':');
                utils[compileKey](node, value, this.vm, eventName);
            } else if (this.isEventName(name)) {
                //@方法执行
                const [, eventName] = name.split('@');
                utils['on'](node, value, this.vm, eventName);
            }
        })

    }
    isEventName(name) {
        return name.startsWith('@');
    }
    isDirector(name) {
        return name.startsWith('v-');
    }
    compileText(node) {
        //{{msg}}
        const content = node.textContent;
        if (/\{\{(.+)\}\}/.test(content)) {
            utils['text'](node, content, this.vm)

        }
    }
}

class Vue {
    constructor(options) {
        this.$el = options.el
        this.$data = options.data;
        this.$options = options;
        //触发this.$data.xx和模板绑定
        new Observer(this.$data);

        //处理模板部分，将模板中使用的data部分变量和模板绑定起来
        new Compiler(this.$el, this);


        this.proxyData(this.$data)
    }
    //可以通过this.xx更改this.$data.xx的结果
    proxyData(data) {
        Object.keys(data).forEach(key => {
            Object.defineProperty(this, key, {
                get() {
                    return data[key];
                },
                set(newVal) {
                    data[key] = newVal;

                }
            });
        })
    }

}