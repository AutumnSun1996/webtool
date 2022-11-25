# WebTool

文本转换辅助工具

使用语法:

```javascript
h()
.split()
.timestamp('iso')
.join()
```


```javascript
h()
.split()
.timestamp('iso')
.join()
```


```javascript
h()
// 处理每个大块
.split('\n\n')
.each((v, k)=>{
    // 处理每块中的所有行
    let lines = v.value().trim().split('\n');
    let val = [lines[0]];
    let delta = v.load_timedelta();
    let dt = v.load_datetime();
    return val.join('\n');
})
.join()
```
