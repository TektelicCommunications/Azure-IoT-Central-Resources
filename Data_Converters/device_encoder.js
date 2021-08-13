var ret = [];
var portNumber = 100;

check_encode("params",
    function (data, port) {
        var converted = base64ToArray(data);
        ret = ret.concat(converted);
        portNumber = port;
    }
);

function check_encode(prop_name, do_write) {
    if (data.hasOwnProperty(prop_name)) {
        var obj = data[prop_name];
        if (obj.hasOwnProperty("port") && obj.hasOwnProperty("data")) {
                do_write(obj.data, obj.port);
        }
    }
}

function atob(input) {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    var str = String(input).replace(/[=]+$/, ''); // #31: ExtendScript bad parse of /=
    if (str.length % 4 === 1) {
        throw new InvalidCharacterError("'atob' failed: The string to be decoded is not correctly encoded.");
    }
    for (
        var bc = 0, bs, buffer, idx = 0, output = '';
        buffer = str.charAt(idx++);
        ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0
    ) {
        buffer = chars.indexOf(buffer);
    }
    return output;
}

function base64ToArray(base64) {
    var binary_string = atob(base64);
    var len = binary_string.length;
    var result = [];
    for (var i = 0; i < len; i++) {
        result.push(binary_string.charCodeAt(i));
    }
    return result;
}

return {
    'bytes': ret,
    'port': portNumber
};