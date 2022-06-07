export const durationOptions = [
  {
    id: 0,
    title: 'h:mm',
    example: '(e.g. 1:23)',
    regex: /(\d+)(?::(\d+))?/
  }, {
    id: 1,
    title: 'h:mm:ss',
    example: '(e.g. 3:45, 1:23:40)',
    regex: /(\d+)?(?::(\d+))?(?:(\d+))?/
  }, {
    id: 2,
    title: 'h:mm:ss.s',
    example: '(e.g. 3:34.6, 1:23:40.0)',
    regex: /(\d+)?(?::(\d+))?(?::(\d+))?(?:.(\d{0,4})?)?/
  }, {
    id: 3,
    title: 'h:mm:ss.ss',
    example: '(e.g. 3.45.67, 1:23:40.00)',
    regex: /(\d+)?(?::(\d+))?(?::(\d+))?(?:.(\d{0,4})?)?/
  }, {
    id: 4,
    title: 'h:mm:ss.sss',
    example: '(e.g. 3.45.678, 1:23:40.000)',
    regex: /(\d+)?(?::(\d+))?(?::(\d+))?(?:.(\d{0,4})?)?/
  }
]

// pad zero
// mm && ss
// e.g.  3 -> 03
// e.g. 12 -> 12
// sss
// e.g.  1 -> 001
// e.g. 10 -> 010
const padZero = (val, isSSS = false) => {
  if (isSSS) {
    if (val >= 0 && val <= 9) {
      return `00${val}`
    } else if (val >= 10 && val <= 99) {
      return `0${val}`
    }
  } else if (val >= 0 && val <= 9) {
    return `0${val}`
  }
  return val
}

export const convertMS2Duration = (val, durationType) => {
  // 600000ms --> 10:00 (10 mins)
  const milliseconds = val % 1000
  const centiseconds = Math.round(milliseconds / 10)
  const deciseconds = Math.round(centiseconds / 10)
  const seconds = Math.floor((val / 1000) % 60)
  const minutes = Math.floor((val / (1000 * 60)) % 60)
  const hours = Math.floor((val / (1000 * 60 * 60)))

  if (durationType === 0) {
    // h:mm
    return `${padZero(hours)}:${padZero(minutes + (seconds >= 30))}`
  } else if (durationType === 1) {
    // h:mm:ss
    return `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)}`
  } else if (durationType === 2) {
    // h:mm:ss.s
    return `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)}.${padZero(deciseconds)}`
  } else if (durationType === 3) {
    // h:mm:ss.ss
    return `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)}.${padZero(centiseconds)}`
  } else if (durationType === 4) {
    // h:mm:ss.sss
    return `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)}.${padZero(milliseconds, true)}`
  }
  return val
}

export const convertDurationToSeconds = (val, durationType) => {
  // 10:00 (10 mins) -> 600000 ms
  const res = {
    _ms: null,
    _isValid: true
  }
  const durationRegex = durationOptions[durationType].regex
  if (durationRegex.test(val)) {
    let h, mm, ss
    const groups = val.match(durationRegex)
    if (groups[0] && groups[1] && !groups[2] && !groups[3] && !groups[4]) {
      const val = parseInt(groups[1], 10)
      if (groups.input.slice(-1) === ':') {
        // e.g. 30:
        h = groups[1]
        mm = 0
        ss = 0
      } else if (durationType === 0) {
        // consider it as minutes
        // e.g. 360 -> 06:00
        h = Math.floor(val / 60)
        mm = Math.floor((val - ((h * 3600)) / 60))
        ss = 0
      } else {
        // consider it as seconds
        // e.g. 3600 -> 01:00:00
        h = Math.floor(groups[1] / 3600)
        mm = Math.floor(groups[1] / 60) % 60
        ss = val % 60
      }
    } else {
      h = groups[1] || 0
      mm = groups[2] || 0
      ss = groups[3] || 0
    }

    if (durationType === 0) {
      // h:mm
      res._ms = h * 3600000 + mm * 60000
    } else if (durationType === 1) {
      // h:mm:ss
      res._ms = h * 3600000 + mm * 60000 + ss * 1000
    } else if (durationType === 2) {
      // h:mm:ss.s (deciseconds)
      const ds = groups[4] || 0
      const len = Math.log(ds) * Math.LOG10E + 1 | 0
      const ms = (
        // e.g. len = 4: 1234 -> 1, 1456 -> 1
        // e.g. len = 3:  123 -> 1,  191 -> 2
        // e.g. len = 2:   12 -> 1 ,  16 -> 2
        len === 4
          ? Math.round(ds / 1000)
          : len === 3
            ? Math.round(ds / 100)
            : len === 2
              ? Math.round(ds / 10)
              // take whatever it is
              : ds
      ) * 100
      res._ms = h * 3600000 + mm * 60000 + ss * 1000 + ms
    } else if (durationType === 3) {
      // h:mm:ss.ss (centiseconds)
      const cs = groups[4] || 0
      const len = Math.log(cs) * Math.LOG10E + 1 | 0
      const ms = (
        // e.g. len = 4: 1234 -> 12, 1285 -> 13
        // e.g. len = 3:  123 -> 12,  128 -> 13
        // check the third digit
        len === 4
          ? Math.round(cs / 100)
          : len === 3
            ? Math.round(cs / 10)
            // take whatever it is
            : cs
      ) * 10
      res._ms = h * 3600000 + mm * 60000 + ss * 1000 + ms
    } else if (durationType === 4) {
      // h:mm:ss.sss (milliseconds)
      let ms = groups[4] || 0
      const len = Math.log(ms) * Math.LOG10E + 1 | 0
      ms = (
        // e.g. 1235 -> 124
        // e.g. 1234 -> 123
        len === 4
          ? Math.round(ms / 10)
          // take whatever it is
          : ms
      ) * 1
      res._ms = h * 3600000 + mm * 60000 + ss * 1000 + ms
    }
  } else {
    res._isValid = false
  }
  return res
}

/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Wing-Kam Wong <wingkwong.code@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
