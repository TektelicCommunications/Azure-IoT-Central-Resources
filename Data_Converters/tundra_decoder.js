function slice(a, f, t) {
    var res = [];
    for (var i = 0; i < t - f; i++) {
        res[i] = a[f + i];
    }
    return res;
}

function extract_bytes(chunk, start_bit, end_bit) {
    var total_bits = end_bit - start_bit + 1;
    var total_bytes = total_bits % 8 === 0 ? to_uint(total_bits / 8) : to_uint(total_bits / 8) + 1;
    var offset_in_byte = start_bit % 8;
    var end_bit_chunk = total_bits % 8;
    var arr = new Array(total_bytes);
    for (var byte = 0; byte < total_bytes; ++byte) {
        var chunk_idx = to_uint(start_bit / 8) + byte;
        var lo = chunk[chunk_idx] >> offset_in_byte;
        var hi = 0;
        if (byte < total_bytes - 1) {
            hi = (chunk[chunk_idx + 1] & ((1 << offset_in_byte) - 1)) << (8 - offset_in_byte);
        } else if (end_bit_chunk !== 0) {
            // Truncate last bits
            lo = lo & ((1 << end_bit_chunk) - 1);
        }
        arr[byte] = hi | lo;
    }
    return arr;
}

function apply_data_type(bytes, data_type) {
    var output = 0;
    if (data_type === "unsigned") {
        for (var i = 0; i < bytes.length; ++i) {
            output = (to_uint(output << 8)) | bytes[i];
        }
        return output;
    }

    if (data_type === "signed") {
        for (var j = 0; j < bytes.length; ++j) {
            output = (output << 8) | bytes[j];
        }
        // Convert to signed, based on value size
        if (output > Math.pow(2, 8 * bytes.length - 1)) {
            output -= Math.pow(2, 8 * bytes.length);
        }
        return output;
    }
    if (data_type === "bool") {
        return (bytes[0] !== 0);
    }
    if (data_type === "hexstring") {
        return toHexString(bytes);
    }
    // Incorrect data type
    return null;
}

function decode_field(chunk, start_bit, end_bit, data_type) {
    var chunk_size = chunk.length;
    if (end_bit >= chunk_size * 8) {
        return null; // Error: exceeding boundaries of the chunk
    }
    if (end_bit < start_bit) {
        return null; // Error: invalid input
    }
    var arr = extract_bytes(chunk, start_bit, end_bit);
    return apply_data_type(arr, data_type);
}

if (port === 32) {
    bytes = slice(bytes, 2, bytes.length);
    port = 10;
}

var decoded_data = {};
var decoder = [];

if(port === 100 && bytes.length === 4) {
    if(checkForCRC(bytes)) {
        decoded_data.message = "Downlink received";
        return decoded_data;
    }
}

if (port === 10) {
    decoder = [
        {
            key: [0x11, 0x02],
            fn: function (arg) {
                decoded_data.external_probe_thermistor_analog_input = decode_field(arg, 0, 15, "signed") * 0.001;
                decoded_data.external_probe_thermistor_analog_input = Math.round(decoded_data.ambient_temperature * 1000) / 1000;
                return 2;
            }
        },
        {
            key: [0x03, 0x67],
            fn: function (arg) {
                decoded_data.ambient_temperature = decode_field(arg, 0, 15, "signed") * 0.1;
                decoded_data.ambient_temperature = Math.round(decoded_data.ambient_temperature * 10) / 10;
                return 2;
            }
        },
        {
            key: [0x04, 0x68],
            fn: function (arg) {
                decoded_data.relative_humidity = decode_field(arg, 0, 7, "unsigned") * 0.5;
                decoded_data.relative_humidity = Math.round(decoded_data.relative_humidity * 10) / 10;
                return 1;
            }
        },
        {
            key: [0x0B, 0x67],
            fn: function (arg) {
                decoded_data.mcu_temperature = decode_field(arg, 0, 15, "signed") * 0.1;
                decoded_data.mcu_temperature = Math.round(decoded_data.mcu_temperature * 10) / 10;
                return 2;
            }
        },
        {
            key: [0x0F, 0x04],
            fn: function (arg) {
                decoded_data.external_probe_reed_switch_count = decode_field(arg, 0, 15, "unsigned");
                return 2;
            }
        },
        {
            key: [0x0E, 0x00],
            fn: function (arg) {
                decoded_data.external_probe_reed_switch_state = decode_field(arg, 0, 7, "unsigned");
                return 1;
            }
        },
        {
            key: [0x00, 0xFF],
            fn: function (arg) {
                decoded_data.battery = decode_field(arg, 0, 15, "signed") * 0.01;
                return 2;
            }
        },
    ];
}
if (port === 100) {
    decoder = [
        {
            key: [0x00],
            fn: function (arg) {
                if(!decoded_data.hasOwnProperty('lorawan')) {
                    decoded_data.lorawan = {};
                }
                decoded_data.lorawan.device_eui = decode_field(arg, 0, 63, "hexstring");
                return 8;
            }
        },
        {
            key: [0x01],
            fn: function (arg) {
                if(!decoded_data.hasOwnProperty('lorawan')) {
                    decoded_data.lorawan = {};
                }
                decoded_data.lorawan.app_eui = decode_field(arg, 0, 63, "hexstring");
                return 8;
            }
        },
        {
            key: [0x02],
            fn: function (arg) {
                if(!decoded_data.hasOwnProperty('lorawan')) {
                    decoded_data.lorawan = {};
                }
                decoded_data.lorawan.app_key = decode_field(arg, 0, 127, "hexstring");
                return 16;
            }
        },
        {
            key: [0x03],
            fn: function (arg) {
                if(!decoded_data.hasOwnProperty('lorawan')) {
                    decoded_data.lorawan = {};
                }
                decoded_data.lorawan.device_address = decode_field(arg, 0, 31, "hexstring");
                return 4;
            }
        },
        {
            key: [0x04],
            fn: function (arg) {
                if(!decoded_data.hasOwnProperty('lorawan')) {
                    decoded_data.lorawan = {};
                }
                decoded_data.lorawan.network_session_key = decode_field(arg, 0, 127, "hexstring");
                return 16;
            }
        },
        {
            key: [0x05],
            fn: function (arg) {
                if(!decoded_data.hasOwnProperty('lorawan')) {
                    decoded_data.lorawan = {};
                }
                decoded_data.lorawan.app_session_key = decode_field(arg, 0, 127, "hexstring");
                return 16;
            }
        },
        {
            key: [0x0F],
            fn: function (arg) {
                if(!decoded_data.hasOwnProperty('s_f_config')) {
                    decoded_data.s_f_config = {};
                }
                decoded_data.s_f_config.rh_tag_status = decode_field(arg, 4, 4, "unsigned");
                decoded_data.s_f_config.temp_tag_status = decode_field(arg, 3, 3, "unsigned");
                decoded_data.s_f_config.ext_probe_tag_status = decode_field(arg, 1, 1, "unsigned");
                return 2;
            }
        },
        {
            key: [0x10],
            fn: function (arg) {
                if(!decoded_data.hasOwnProperty('loramac')) {
                    decoded_data.loramac = {};
                }
                decoded_data.loramac.join_mode = decode_field(arg, 7, 7, "unsigned");
                return 2;
            }
        },
        {
            key: [0x11],
            fn: function (arg) {
                if(!decoded_data.hasOwnProperty('loramac')) {
                    decoded_data.loramac = {};
                }
                if(!decoded_data.loramac.hasOwnProperty('loramac_opts')) {
                    decoded_data.loramac.loramac_opts = {};
                }
                decoded_data.loramac.loramac_opts.confirm_mode = decode_field(arg, 8, 8, "unsigned");
                decoded_data.loramac.loramac_opts.sync_word = decode_field(arg, 9, 9, "unsigned");
                decoded_data.loramac.loramac_opts.duty_cycle = decode_field(arg, 10, 10, "unsigned");
                decoded_data.loramac.loramac_opts.adr = decode_field(arg, 11, 11, "unsigned");
                return 2;
            }
        },
        {
            key: [0x12],
            fn: function (arg) {
                if(!decoded_data.hasOwnProperty('loramac')) {
                    decoded_data.loramac = {};
                }
                if(!decoded_data.loramac.hasOwnProperty('loramac_dr_tx')) {
                    decoded_data.loramac.loramac_dr_tx = {};
                }
                decoded_data.loramac.loramac_dr_tx.dr_number = decode_field(arg, 0, 3, "unsigned");
                decoded_data.loramac.loramac_dr_tx.tx_power = decode_field(arg, 8, 11, "unsigned");
                return 2;
            }
        },
        {
            key: [0x13],
            fn: function (arg) {
                if(!decoded_data.hasOwnProperty('loramac')) {
                    decoded_data.loramac = {};
                }
                if(!decoded_data.loramac.hasOwnProperty('loramac_rx2')) {
                    decoded_data.loramac.loramac_rx2 = {};
                }
                decoded_data.loramac.loramac_rx2.frequency = decode_field(arg, 0, 31, "unsigned");
                decoded_data.loramac.loramac_rx2.dr_number = decode_field(arg, 32, 39, "unsigned");
                return 5;
            }
        },
        {
            key: [0x19],
            fn: function (arg) {
                if(!decoded_data.hasOwnProperty('loramac')) {
                    decoded_data.loramac = {};
                }
                decoded_data.loramac.loramac_net_id_msb = decode_field(arg, 0, 15, "unsigned");
                return 2;
            }
        },
        {
            key: [0x1A],
            fn: function (arg) {
                if(!decoded_data.hasOwnProperty('loramac')) {
                    decoded_data.loramac = {};
                }
                decoded_data.loramac.loramac_net_id_lsb = decode_field(arg, 0, 15, "unsigned");
                return 2;
            }
        },
        {
            key: [0x20],
            fn: function (arg) {
                if(!decoded_data.hasOwnProperty('ticks')) {
                    decoded_data.ticks = {};
                }
                decoded_data.ticks.core = decode_field(arg, 0, 31, "unsigned");
                return 4;
            }
        },
        {
            key: [0x21],
            fn: function (arg) {
                if(!decoded_data.hasOwnProperty('ticks')) {
                    decoded_data.ticks = {};
                }
                decoded_data.ticks.per_battery = decode_field(arg, 0, 15, "unsigned");
                return 2;
            }
        },
        {
            key: [0x22],
            fn: function (arg) {
                if(!decoded_data.hasOwnProperty('ticks')) {
                    decoded_data.ticks = {};
                }
                decoded_data.ticks.per_ambient_temp = decode_field(arg, 0, 15, "unsigned");
                return 2;
            }
        },
        {
            key: [0x23],
            fn: function (arg) {
                if(!decoded_data.hasOwnProperty('ticks')) {
                    decoded_data.ticks = {};
                }
                decoded_data.ticks.per_ambient_humidity = decode_field(arg, 0, 15, "unsigned");
                return 2;
            }
        },
        {
            key: [0x27],
            fn: function (arg) {
                if(!decoded_data.hasOwnProperty('ticks')) {
                    decoded_data.ticks = {};
                }
                decoded_data.ticks.per_mcu_temperature = decode_field(arg, 0, 15, "unsigned");
                return 2;
            }
        },
        {
            key: [0x29],
            fn: function (arg) {
                if(!decoded_data.hasOwnProperty('ticks')) {
                    decoded_data.ticks = {};
                }
                decoded_data.ticks.per_ext_probe = decode_field(arg, 0, 15, "unsigned");
                return 2;
            }
        },
        {
            key: [0x2D],
            fn: function (arg) {
                if(!decoded_data.hasOwnProperty('ext_probe')) {
                    decoded_data.ext_probe = {};
                }
                decoded_data.ext_probe.input_mode = decode_field(arg, 7, 7, "unsigned");
                decoded_data.ext_probe.falling_edge = decode_field(arg, 1, 1, "unsigned");
                decoded_data.ext_probe.rising_edge = decode_field(arg, 0, 0, "unsigned");
                return 1;
            }
        },
        {
            key: [0x2E],
            fn: function (arg) {
                if(!decoded_data.hasOwnProperty('ext_probe')) {
                    decoded_data.ext_probe = {};
                }
                decoded_data.ext_probe.count_threshold = decode_field(arg, 0, 15, "unsigned");
                return 2;
            }
        },
        {
            key: [0x2F],
            fn: function (arg) {
                if(!decoded_data.hasOwnProperty('ext_probe')) {
                    decoded_data.ext_probe = {};
                }
                decoded_data.ext_probe.digital_input_count = decode_field(arg, 1, 1, "unsigned");
                decoded_data.ext_probe.digital_input_state = decode_field(arg, 0, 0, "unsigned");
                return 1;
            }
        },
        {
            key: [0x39],
            fn: function (arg) {
                if(!decoded_data.hasOwnProperty('temperature_humidity')) {
                    decoded_data.temperature_humidity = {};
                }
                decoded_data.temperature_humidity.sample_period_idle = decode_field(arg, 0, 31, "unsigned");
                return 4;
            }
        },
        {
            key: [0x3A],
            fn: function (arg) {
                if(!decoded_data.hasOwnProperty('temperature_humidity')) {
                    decoded_data.temperature_humidity = {};
                }
                decoded_data.temperature_humidity.sample_period_active = decode_field(arg, 0, 31, "unsigned");
                return 4;
            }
        },
        {
            key: [0x3B],
            fn: function (arg) {
                if(!decoded_data.hasOwnProperty('temperature_humidity')) {
                    decoded_data.temperature_humidity = {};
                }
                if(!decoded_data.temperature_humidity.hasOwnProperty('temperature_threshold')) {
                    decoded_data.temperature_humidity.temperature_threshold = {};
                }
                decoded_data.temperature_humidity.temperature_threshold.low = decode_field(arg, 8, 15, "signed");
                decoded_data.temperature_humidity.temperature_threshold.low = Math.round(decoded_data.temperature_humidity.temperature_threshold.low * 10) / 10;
                decoded_data.temperature_humidity.temperature_threshold.high = decode_field(arg, 0, 7, "signed");
                decoded_data.temperature_humidity.temperature_threshold.high = Math.round(decoded_data.temperature_humidity.temperature_threshold.high * 10) / 10;
                return 2;
            }
        },
        {
            key: [0x3C],
            fn: function (arg) {
                if(!decoded_data.hasOwnProperty('temperature_humidity')) {
                    decoded_data.temperature_humidity = {};
                }
                decoded_data.temperature_humidity.temperature_threshold_enable = decode_field(arg, 0, 0, "unsigned");
                return 1;
            }
        },
        {
            key: [0x3D],
            fn: function (arg) {
                if(!decoded_data.hasOwnProperty('temperature_humidity')) {
                    decoded_data.temperature_humidity = {};
                }
                if(!decoded_data.temperature_humidity.hasOwnProperty('rh_threshold')) {
                    decoded_data.temperature_humidity.rh_threshold = {};
                }
                decoded_data.temperature_humidity.rh_threshold.low = decode_field(arg, 8, 15, "signed");
                decoded_data.temperature_humidity.rh_threshold.low = Math.round(decoded_data.temperature_humidity.rh_threshold.low * 10) / 10;
                decoded_data.temperature_humidity.rh_threshold.high = decode_field(arg, 0, 7, "signed");
                decoded_data.temperature_humidity.rh_threshold.high = Math.round(decoded_data.temperature_humidity.rh_threshold.high * 10) / 10;
                return 2;
            }
        },
        {
            key: [0x3E],
            fn: function (arg) {
                if(!decoded_data.hasOwnProperty('temperature_humidity')) {
                    decoded_data.temperature_humidity = {};
                }
                if(!decoded_data.temperature_humidity.hasOwnProperty('rh_enable')) {
                    decoded_data.temperature_humidity.rh_enable = {};
                }
                decoded_data.temperature_humidity.rh_enable.rh_threshold_enable = decode_field(arg, 0, 0, "unsigned");
                return 1;
            }
        },
        {
            key: [0x40],
            fn: function (arg) {
                if(!decoded_data.hasOwnProperty('mcu_temperature')) {
                    decoded_data.mcu_temperature = {};
                }
                decoded_data.mcu_temperature.sample_period_idle = decode_field(arg, 0, 31, "unsigned");
                return 4;
            }
        },
        {
            key: [0x41],
            fn: function (arg) {
                if(!decoded_data.hasOwnProperty('mcu_temperature')) {
                    decoded_data.mcu_temperature = {};
                }
                decoded_data.mcu_temperature.sample_period_active = decode_field(arg, 0, 31, "unsigned");
                return 4;
            }
        },
        {
            key: [0x42],
            fn: function (arg) {
                if(!decoded_data.hasOwnProperty('mcu_temperature')) {
                    decoded_data.mcu_temperature = {};
                }
                if(!decoded_data.mcu_temperature.hasOwnProperty('threshold')) {
                    decoded_data.mcu_temperature.threshold = {};
                }
                decoded_data.mcu_temperature.threshold.high = decode_field(arg, 0, 7, "signed");
                decoded_data.mcu_temperature.threshold.high = Math.round(decoded_data.mcu_temperature.threshold.high * 10) / 10;
                decoded_data.mcu_temperature.threshold.low = decode_field(arg, 8, 15, "signed");
                decoded_data.mcu_temperature.threshold.low = Math.round(decoded_data.mcu_temperature.threshold.low * 10) / 10;
                return 2;
            }
        },
        {
            key: [0x43],
            fn: function (arg) {
                if(!decoded_data.hasOwnProperty('mcu_temperature')) {
                    decoded_data.mcu_temperature = {};
                }
                decoded_data.mcu_temperature.threshold_enable = decode_field(arg, 0, 0, "unsigned");
                return 1;
            }
        },
        {
            key: [0x44],
            fn: function (arg) {
                if(!decoded_data.hasOwnProperty('thermistor')) {
                    decoded_data.thermistor = {};
                }
                decoded_data.thermistor.ext_thermistor_sample_period_idle = decode_field(arg, 0, 31, "unsigned");
                return 4;
            }
        },
        {
            key: [0x45],
            fn: function (arg) {
                if(!decoded_data.hasOwnProperty('thermistor')) {
                    decoded_data.thermistor = {};
                }
                decoded_data.thermistor.ext_thermistor_sample_period_active = decode_field(arg, 0, 31, "unsigned");
                return 4;
            }
        },
        {
            key: [0x46],
            fn: function (arg) {
                if(!decoded_data.hasOwnProperty('thermistor')) {
                    decoded_data.thermistor = {};
                }
                decoded_data.thermistor.ext_thermistor_low_threshold = decode_field(arg, 16, 31, "unsigned");
                decoded_data.thermistor.ext_thermistor_high_threshold = decode_field(arg, 0, 15, "unsigned");
                return 4;
            }
        },
        {
            key: [0x4A],
            fn: function (arg) {
                if(!decoded_data.hasOwnProperty('thermistor')) {
                    decoded_data.thermistor = {};
                }
                decoded_data.thermistor.ext_thermistor_threshold_enable = decode_field(arg, 0, 0, "unsigned");
                return 1;
            }
        },
        {
            key: [0x71],
            fn: function (arg) {
                if(!decoded_data.hasOwnProperty('command_control_register')) {
                    decoded_data.command_control_register = {};
                }
                if(!decoded_data.command_control_register.hasOwnProperty('firmware_version')) {
                    decoded_data.command_control_register.firmware_version = {};
                }
                decoded_data.command_control_register.firmware_version.app_major_version = decode_field(arg, 0, 7, "unsigned");
                decoded_data.command_control_register.firmware_version.app_minor_version = decode_field(arg, 8, 15, "unsigned");
                decoded_data.command_control_register.firmware_version.app_revision = decode_field(arg, 16, 23, "unsigned");
                decoded_data.command_control_register.firmware_version.loramac_major_version = decode_field(arg, 24, 31, "unsigned");
                decoded_data.command_control_register.firmware_version.loramac_minor_version = decode_field(arg, 32, 39, "unsigned");
                decoded_data.command_control_register.firmware_version.loramac_revision = decode_field(arg, 40, 47, "unsigned");
                decoded_data.command_control_register.firmware_version.region = decode_field(arg, 48, 55, "unsigned");
                return 7;
            }
        }
    ];
}

bytes = convertToUint8Array(bytes);
decoded_data.raw = JSON.stringify(byteToArray(bytes));
decoded_data.port = port;

for (var bytes_left = bytes.length; bytes_left > 0;) {
    var found = false;
    for (var i = 0; i < decoder.length; i++) {
        var item = decoder[i];
        var key = item.key;
        var keylen = key.length;
        var header = slice(bytes, 0, keylen);
        // Header in the data matches to what we expect
        if (is_equal(header, key)) {
            var f = item.fn;
            var consumed = f(slice(bytes, keylen, bytes.length)) + keylen;
            bytes_left -= consumed;
            bytes = slice(bytes, consumed, bytes.length);
            found = true;
            break;
        }
    }
    if (found) {
        continue;
    }
    // Unable to decode -- headers are not as expected, send raw payload to the application!
    decoded_data = {};
    decoded_data.raw = JSON.stringify(byteToArray(bytes));
    decoded_data.port = port;
    return decoded_data;
}

// Converts value to unsigned
function to_uint(x) {
    return x >>> 0;
}

// Checks if two arrays are equal
function is_equal(arr1, arr2) {
    if (arr1.length != arr2.length) {
        return false;
    }
    for (var i = 0; i != arr1.length; i++) {
        if (arr1[i] != arr2[i]) {
            return false;
        }
    }
    return true;
}

function byteToArray(byteArray) {
    var arr = [];
    for (var i = 0; i < byteArray.length; i++) {
        arr.push(byteArray[i]);
    }
    return arr;
}

function convertToUint8Array(byteArray) {
    var arr = [];
    for (var i = 0; i < byteArray.length; i++) {
        arr.push(to_uint(byteArray[i]) & 0xff);
    }
    return arr;
}

function toHexString(byteArray) {
    var arr = [];
    for (var i = 0; i < byteArray.length; ++i) {
        arr.push(('0' + (byteArray[i] & 0xFF).toString(16)).slice(-2));
    }
    return arr.join('');
}

function checkForCRC(bytes) {
    var hexArray = [];

    for(i in bytes) {
        hexArray[i] = toHexString(bytes[i].toString(16).toUpperCase());
    }

    if(decoder.hasOwnProperty(hexArray[0])) {
        dataSize = decoder[hexArray[0]][0]["data_size"];

        if(dataSize == 3) {
            return false;
        }
        else if(dataSize == 1 && decoder.hasOwnProperty(hexArray[2]) && decoder[hexArray[2]][0]["data_size"] == 1) {
            return false;
        }
    }
    return true;
}

for(i in decoded_data) {
    if(i != 'raw' && i != 'port') {
        tmp = decoded_data[i];
        decoded_data[i] = JSON.stringify(tmp);
    }
}

return decoded_data;