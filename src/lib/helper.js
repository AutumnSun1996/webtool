import * as yaml from 'js-yaml';
import { Buffer } from 'buffer';
import { DateTime } from "luxon";
import cryptoRandomString from 'crypto-random-string';

window.DateTime = DateTime;

function capitalize(word) {
    return word.slice(0, 1).toUpperCase() + word.slice(1).toLowerCase();
}
function getRandomString(config1, config2) {
    let prefixMap = {
        'hex': { type: 'hex' },
        'b64': { type: 'base64' },
        'b64url': { type: 'base64', url_safe: true },
        'base64': { type: 'base64' },
        'base64url': { type: 'base64', url_safe: true },
        'words': { type: 'words' },
        'alphanumeric': { characters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' },
        'distinguishable': { characters: '23456789abcdefghjkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ' },
        'Distinguishable': { characters: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' },
        'printable': { characters: `!"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_\`abcdefghijklmnopqrstuvwxyz{|}~` },
        'numeric': { characters: '0123456789' },
        'urlsafe': { characters: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~' },
    }
    if (typeof config1 !== 'object') {
        config1 = { length: 16 };
    }
    if (typeof config2 === 'string') {
        let match;
        match = /port(\s+\d+)?(\s+\d+)?/.exec(config2);
        if (match) {
            // port [min] [max]
            const randomBuffer = new Uint32Array(1);
            crypto.getRandomValues(randomBuffer);
            let randVal = randomBuffer[0] / 0xffffffff;
            let minVal = parseInt(match[1] || 10000);
            let maxVal = parseInt(match[2] || 65536);
            if (minVal > maxVal) { [minVal, maxVal] = [maxVal, minVal] };
            console.log('get port', minVal, maxVal, randVal);
            return Math.floor((maxVal - minVal) * randVal + minVal);
        }
        // <len> ' ' <type-prefix>
        // <len> ' ' 'c:'/'char:'/'chars:' <chars>
        match = /(\d+)\s+(c\:)?(\w+)/.exec(config2);
        if (match) {
            config2 = { length: parseInt(match[1]) };
            if (match[2]) {
                config2.characters = match[3];
            } else {
                for (let prefix in prefixMap) {
                    if (prefix.startsWith(match[3])) {
                        config2 = { ...config2, ...prefixMap[prefix] };
                        break;
                    }
                }
            }
        }
    } else if (typeof config2 !== 'object') {
        config2 = {};
    }
    let config = { ...config1, ...config2 };
    if (config.type === 'words') {
        let value = niceware.generatePassphrase(config.length * 2);
        return value.map(capitalize).join('');
    }
    if (config.type === 'base64') {
        const randomBuffer = new Uint8Array(config.length);
        crypto.getRandomValues(randomBuffer);
        let value = Buffer.from(randomBuffer).toString('base64');
        if (config.url_safe) {
            value = value.replace(/\+/g, '_').replace(/\//g, '_')
        }
        return value;
    }
    return cryptoRandomString(config);
}

class BaseSerde {
    convert(value, action) {
        return this[action](value);
    }
    auto(value) {
        let inType = typeof value;
        let action = '';
        if (inType !== 'string') {
            action = 'dump';
            value = this.dump(value);
        } else {
            try {
                value = this.load(value);
                action = 'load';
            } catch (error) {
                console.log('LOAD Failed', error);
                action = 'dump';
                value = this.dump(value);
            }
        }
        console.log('run auto:', action, inType, typeof value);
        return { value, action };
    }
    load(value) {
        return value;
    }
    dump(value) {
        return value;
    }
}
class JSONSerde extends BaseSerde {
    load(value) {
        return JSON.parse(value);
    }
    dump(value) {
        return JSON.stringify(value, null, 2);
    }
}
class JSSerde extends BaseSerde {
    load(value) {
        let env = `let True=true,False=false,None=null;`
        return Function(env + '\nreturn ( ' + value + ' )')();
    }
    dump(value) {
        return JSON.stringify(value, null, 2);
    }
}
class YamlSerde extends BaseSerde {
    load(value) {
        try {
            return yaml.load(value);
        } catch (error) {
            return yaml.loadAll(value);
        }
    }
    dump(value) {
        return yaml.dump(value);
    }
}

function getLocalISOString(date) {
    // Get local time as ISO string with offset at the end
    console.log('getLocalISOString', date);
    if (!date) {
        date = new Date();
    }
    var tzo = -date.getTimezoneOffset();
    if (tzo === 0) {
        return date.toISOString();
    }
    var dif = tzo >= 0 ? '+' : '-';
    var pad = function (n, width) {
        width = width || 2;
        n = Math.abs(Math.floor(n)) + '';
        return n.length >= width ? n : new Array(width - n.length + 1).join('0') + n;
    };
    return date.getFullYear()
        + '-' + pad(date.getMonth() + 1)
        + '-' + pad(date.getDate())
        + 'T' + pad(date.getHours())
        + ':' + pad(date.getMinutes())
        + ':' + pad(date.getSeconds())
        + '.' + pad(date.getMilliseconds(), 3)
        + dif + pad(tzo / 60)
        + ':' + pad(tzo % 60);
}

class DateSerde extends BaseSerde {
    load(value) {
        if (typeof value === 'string') {
            value = value.trim();
        }
        if (value === 'now') {
            return DateTime.now();
        }
        if (/^\s*\d+(\.\d+)?\s*$/.test(value)) {
            return DateTime.fromMillis(parseFloat(value));
        }
        return DateTime.fromISO(value);
    }
    dump(value) {
        if (!value) {
            return null;
        }
        if (!(value instanceof DateTime)) {
            value = this.load(value);
        }
        return value.toISO()
    }
}

class Base64Serde extends BaseSerde {
    auto(value) {
        let action;
        try {
            value = this.load(value);
            action = 'load';
        }
        catch (error) {
            value = this.dump(value);
            action = 'dump';
        }
        return { value, action };
    }
    load(value) {
        return Buffer.from(value, 'base64').toString('utf8');
    }
    dump(value) {
        if (!(value instanceof Buffer)) {
            value = Buffer.from(value, 'utf8')
        }
        return value.toString('base64');
    }
}
class HexSerde extends Base64Serde {
    load(value) {
        return Buffer.from(value, 'hex').toString('utf8');
    }
    dump(value) {
        if (!(value instanceof Buffer)) {
            value = Buffer.from(value, 'utf8')
        }
        return value.toString('hex');
    }
}
const SerdeMap = {
    js: new JSSerde(),
    json: new JSONSerde(),
    yaml: new YamlSerde(),
    base64: new Base64Serde(),
    date: new DateSerde(),
    hex: new HexSerde(),
};
function deepUpdate(dst, src) {
    if (typeof dst !== 'object' || typeof src !== 'object') {
        return src;
    }
    for (let key in src) {
        dst[key] = deepUpdate(dst[key], src[key]);
    }
    return dst;
}

class Helper {
    constructor(data) {
        this.data = data;
        this.path = '$';
        this.meta = {};

        let ref = this;
        for (let key in SerdeMap) {
            this[key] = function (action = 'auto') {
                return ref.convertWithSerde(ref.value(), key, action);
            };
            this['load' + key] = function () {
                return ref.convertWithSerde(ref.value(), key, 'load');
            };
            this['dump' + key] = function () {
                return ref.convertWithSerde(ref.value(), key, 'dump');
            };
        }
    }
    convertWithSerde(value, format, action) {
        let result = SerdeMap[format][action](value);
        console.log('convertWithSerde', format, action, JSON.stringify(value), JSON.stringify(result))
        if (action === 'auto') {
            action = result.action;
            result = result.value;
        }
        this.meta[action] = format;
        return this.set(result);
    }
    _targetRef(path) {
        if (!path) {
            path = this.path;
        }
        let keys = path.split('.').slice(1);
        if (keys.length === 0) {
            return { ref: this, key: 'data' };
        }
        let lastKey = keys.splice(keys.length - 1, 1)[0];
        let target = this.data;
        for (let key of keys) {
            target = target[key];
        }
        console.log('get ref:', keys, lastKey);
        return { ref: target, key: lastKey };
    }
    value(path) {
        let { ref, key } = this._targetRef(path);
        return ref[key];
    }
    // 可链式调用的函数
    pop(...keys) {
        if (keys.length === 0) {
            // 删除当前路径的数据
            let { ref, key } = this._targetRef();
            delete ref[key];
        }
        else {
            let ref = this.value();
            for (let key of keys) {
                delete ref[key];
            }
        }
        return this;
    }
    set(value) {
        let { ref, key } = this._targetRef();
        ref[key] = value;
        return this;
    }
    merge(value) {
        let { ref, key } = this._targetRef();
        deepUpdate(ref, { [key]: value });
        return this;
    }
    copyTo(path) {
        let dst = this._targetRef(path);
        dst.ref[dst.key] = this.value();
        return this;
    }
    moveTo(path) {
        // 将当前节点的数据移动到目标位置
        let src = this._targetRef();
        let dst = this._targetRef(path);
        dst.ref[dst.key] = src.ref[src.key];
        delete src.ref[src.key];
        this.path = path;
        return this;
    }
    each(handler) {
        let target = this.value();
        for (let key in target) {
            let val = new Helper(target[key])
            let ret = handler(val, key);
            if (ret instanceof Helper) {
                ret = ret.value();
            }
            target[key] = ret;
        }
        return this;
    }
    cond(condition, iftrue, iffalse) {
        if (condition(this)) {
            iftrue && iftrue(this)
        } else {
            iffalse && iffalse(this);
        }
        return this;
    }
    at(path) {
        let keys = this.path.split('.');
        for (let key of (path.toString()).split('.')) {
            if (key === '') {
                keys.pop();
            }
            else if (key === '$') {
                keys = ['$'];
            }
            else {
                keys.push(key);
            }
            console.log(keys, key);
        }
        this.path = keys.join('.');
        return this;
    }
    root() {
        return this.at('$');
    }
    // Common convert
    convert(fmt, action = 'auto') {
        let value = this.value();
        value = SerdeMap[fmt][action](value);
        this.set(value);
        return this;
    }
    load(fmt) {
        return this.convert(fmt, 'load');
    }
    dump(fmt) {
        return this.convert(fmt, 'dump');
    }
    float() {
        return this.set(parseFloat(this.value()));
    }
    int() {
        return this.set(parseInt(this.value()));
    }
    sub(target, value) {
        let val = this.value().toString();
        this.set(val.replace(target, value));
        return this;
    }
    timestamp(timeFormat = 'iso') {
        let value = this.value();
        value = SerdeMap.date.load(value);
        // let value = DateTime.now();
        switch (timeFormat) {
            case 'epoch_ms':
            case 'unix_ms':
            case 'ms':
                value = value.toMillis();
                break;
            case 'epoch_s':
            case 'epoch':
            case 'unix_s':
            case 'unix':
                value = value.toMillis() / 1000;
                break;
            case 'iso':
                value = value.toISO();
                break;
            case 'date':
            case 'isodate':
                value = value.toISODate();
                break;
            case 'http':
                value = value.toHTTP();
                break;
            case 'sql':
                value = value.toSQL();
                break;
            case '2822':
            case 'rfc2822':
                value = value.toRFC2822();
                break;
            case 'http':
                value = value.toHTTP();
                break;
            default:
                value = value.toFormat(timeFormat);
        }
        return this.set(value);
    }
    // Extra shorcut for Base64
    b64(action = 'auto') {
        return this.convertWithSerde(this.value(), 'base64', action);
    }
    b64dec() {
        return this.b64('load');
    }
    b64enc() {
        return this.b64('dump');
    }
    /**
     * 生成随机字符串
     */
    randoms(config) {
        let lines = [];
        for (let val of this.value().split('\n')) {
            if (val === '') {
                lines.push('')
                continue;
            }
            // console.log('random', lineConfig);
            lines.push(getRandomString(config, val));
        }
        return this.set(lines.join('\n'));
    }
    split(char = '\n') {
        return this.set(this.value().split(char));
    }
    join(char = '\n') {
        return this.set(this.value().join(char));
    }
    // 不可链式调用的函数
    /**
     * 返回正则表达式提取结果
     */
    regex(regexp) {
        if (!(regexp instanceof RegExp)) {
            regexp = new RegExp(regexp);
        }
        let val = this.value();
        return val.matchAll(regexp);
    }
}

class HelperArray extends Helper {

}

export default Helper;
