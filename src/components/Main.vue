<script setup lang="ts">
import { computed, onMounted, ref, watch, watchEffect } from 'vue';
import Editor from 'codemirror-editor-vue3'
import Helper from "../lib/helper";
import { getData, saveData } from "../lib/store";

// language
import "codemirror/mode/javascript/javascript.js";
import "codemirror/mode/yaml/yaml.js";

// theme
import "codemirror/theme/dracula.css";

let initData = getData();
console.log('initData', initData);
let data = ref(initData);

const cmInDom = ref(null);
const cmOutDom = ref(null);
const resultRefresh = ref(0);

const FmtModeMap = {
  'js': 'text/javascript',
  'yaml': 'text/yaml',
  'json': 'application/json',
};
const InOutMap = {};

onMounted(() => {
  InOutMap['load'] = cmInDom.value?.cminstance;
  InOutMap['dump'] = cmInDom.value?.cminstance;
  window.InOutMap = InOutMap;
});

let defaultOptions = {
  mode: FmtModeMap.js, // Language mode
  // theme: "dracula", // Theme
  lineNumbers: true, // Show line number
  smartIndent: true, // Smart indent
  indentUnit: 2, // The smart indent unit is 2 spaces in length
  foldGutter: true, // Code folding
  styleActiveLine: true, // Display the style of the selected row
}

let readonlyOptions = {
  ...defaultOptions,
  readOnly: true
}
// let current = ref(initData.current);

watchEffect(() => {
  console.log('data updated:', data.value);
  let current = data.value.current;
  data.value.history[current.name] = current.value;
  for (let key in data.value.history) {
    if (key === current.name) {
      continue;
    }
    if (!data.value.commands[key]) {
      delete data.value.history[key];
    }
  }
  saveData(data.value);
});

function addCommand() {
  let current = data.value.current;
  data.value.commands[current.name] = {
    command: current.command,
    value: current.value,
  };
}

function delCommand() {
  let current = data.value.current;
  delete data.value.commands[current.name];
}

function setCommand(name) {
  if (name === data.value.current.name) {
    // 可能涉及随机生成, 因此应触发重新计算：更新resultRefresh, 触发数据更新
    resultRefresh.value++;
    return;
  }
  let target = data.value.commands[name];
  data.value.current.name = name;
  data.value.current.command = target.command;
  let val = data.value.history[name];
  // console.log('SetCommand', name, target.command, val);
  if (val) {
    data.value.current.value = val;
  }
  saveData(data.value);
}

let convertFunction = computed(() => {
  let current = data.value.current;
  let cmd = current.command;
  if (cmd.indexOf('return ') === -1) {
    cmd = `return ( ${cmd} );`;
  }
  return Function('h', cmd);
});

const copyCommand = () => {
  console.log('copyCommand');
  let current = data.value.current;
  let cmd = current.command;
  let cmdMap = data.value.commands;
  // console.log(
  //   'UpdateCmd', current.name,
  //   JSON.stringify(cmdMap[current.name]),
  //   JSON.stringify(cmd),
  // );
  let idx = 1;
  let basename = current.name;
  while (true) {
    // console.log(
    //   'Compare', current.name,
    //   JSON.stringify(cmdMap[current.name].command),
    //   JSON.stringify(cmd),
    // );
    if (!cmdMap[current.name]) {
      break;
    }
    current.name = basename + ' ' + idx;
    idx++;
  }
}

let result = computed(() => {
  // 访问resultRefresh.value;
  resultRefresh.value;
  let inputValue = data.value.current.value;
  try {
    let value = convertFunction.value((val) => new Helper(val || inputValue));
    if (value instanceof Helper) {
      for (let key of ['load', 'dump']) {
        let fmt = FmtModeMap[value.meta[key]] || FmtModeMap.js;
        console.log('Set mode', key, fmt);
        let cm = InOutMap[key];
        if (cm && cm.options.mode !== fmt) {
          cm.refresh();
          cm.setOption('mode', fmt);
        }
      }
      value = value.value();
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return value + '';
  } catch (error) {
    console.error(error);
    for (let key of ['load', 'dump']) {
      console.log('Set mode', key, FmtModeMap.js);
      InOutMap[key]?.setOption('mode', FmtModeMap.js)
    }
    return error.toString();
  }
});

</script>

<template>
  <div class="header">
    <div class="h1">文本处理工具</div>
    <hr>
    <div>
      <div class="commands">
        <button class="command" v-for="_, name in data.commands" :value="name" @click="setCommand(name)">{{ name
        }}</button>
      </div>
      <br>
      <input type="text" v-model="data.current.name">
      <button @click="addCommand">保存指令</button>
      <button @click="copyCommand">复制指令</button>
      <button @click="delCommand">删除指令</button>
    </div>
  </div>
  <div class="panel-holder">
    <Editor class="panel left" :options="defaultOptions" v-model:value="data.current.command">
    </Editor>
    <Editor class="panel center" :options="defaultOptions" v-model:value="data.current.value" ref="cmInDom"></Editor>
    <Editor class="panel right" :options="readonlyOptions" :value="result" ref="cmOutDom"></Editor>
  </div>
</template>

<style scoped>
.h1 {
  font-size: 2em;
  font-weight: bold;
  padding: 0.1em 0 0em 0;
}

.command {
  margin: 2px 4px 2px 4px;
}

.panel-holder {
  text-align: left;
  width: 100%;
  height: 80%;
  position: absolute;
  margin: auto;
  bottom: 0;
}

.panel {
  height: 100%;
  position: absolute;
  word-break: break-all;
}

.panel.left {
  width: 20%;
  left: 0;
  top: 0;
}

.panel.center {
  width: 40%;
  left: 20%;
  top: 0;
}

.panel.right {
  width: 40%;
  right: 0;
  top: 0;
}
</style>