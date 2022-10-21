import dayjs from 'dayjs';

export class DateService {

  static getUtcTimestampFromJstDateString(dateString: string): number {

    if (!dateString.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
      throw 'invalid date type. only allow type: yyyy-mm-dd hh:mm:ss';
    }
    const parse = dateString.split(' ');
    return dayjs(`${parse[0]}T${parse[1]}+09:00`).valueOf();
  }

  static getPastUtcTimestamp(num: number, unit: any): number {

    const allow = [ 'w', 'd', 'h', 'm', 's' ];
    if (!allow.includes(unit)) {
      throw `invalid unit type. select: ${allow.join(',')}`;
    }
    return dayjs().subtract(num, unit).valueOf();
  }
}
