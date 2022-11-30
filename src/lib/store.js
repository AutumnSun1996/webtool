import * as yaml from 'js-yaml';

const TOOL_DATA_KEY = 'TOOLS_DATA';
const DEFAULT_COMMANDS = `
commands:
  "Base64 -> JSON":
    command: |
      h()
      .b64dec()
      .loadyaml()
      .dumpjson()
  "Base64 -> Yaml":
    command: |
      h()
      .b64dec()
      .loadyaml()
      .dumpyaml()
  "JSON -> Yaml":
    command: |
      h()
      .loadjson()
      .dumpyaml()
  "Yaml":
    command: |
      h()
      .loadyaml()
      .dumpyaml()
  "Yaml -> Json":
    command: |
      h()
      .loadyaml()
      .dumpjson()
  "Base64":
    command: |
      h().value()
      +'\\n# Decoded:\\n' +
      h()
      .b64dec()
      .value()
  "-> Base64":
    command: |
      h()
      .b64enc()
  "K8S Secret":
    command: |
      h()
      .loadyaml()
      // 将data转换为stringData
      .at('$.data')
      .each(v=>v.b64dec())
      .moveTo('.stringData')
      // 删除多余字段
      .at('$.metadata')
      .pop(
        'creationTimestamp',
        'resourceVersion',
        'selfLink',
        'uid',
      )
      // 展示为Yaml
      .at('$')
      .dumpyaml()
  "RandomString":
    command: |
      h()
      .randoms()
  "Timestamp":
    command: |
      h()
      .split('\\n')
      .each(v=>
         v.data.length===0?'':
         v.timestamp('iso').data
         + ' | ' +
         v.timestamp('unix_ms').data
      )
      .join()
current:
  name: Custom
  command: |
    // 转换函数
    h()
    .loadyaml()
    .dumpyaml()
  value: |
    # 数据
    test: Test
history:
  RandomString: |
    32 d
    32 d

    24 d
    24 d

    12 d
    12 d

    8 d
    8 d
`;

/**
 * 获取本地的历史数据
 */
function getData() {
  try {
    let jsonValue = localStorage.getItem(TOOL_DATA_KEY);
    console.log('GET', jsonValue);
    if (jsonValue) {
      let data = JSON.parse(jsonValue);
      return data;
    }
  } catch (error) {
    console.error(error);
  }
  try {
    let data = yaml.load(DEFAULT_COMMANDS);
    console.log('GET', 'Default', data);
    return data;
  } catch (error) {
    console.error(error);
  }
  return { commands: {}, current: {}, history: {} };
}

function saveData(data) {
  let jsonValue = JSON.stringify(data);
  // console.log('SAVE:', jsonValue);
  localStorage.setItem(TOOL_DATA_KEY, jsonValue);
}

export {
  getData,
  saveData,
}
