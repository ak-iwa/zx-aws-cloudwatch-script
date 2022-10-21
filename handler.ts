import { $, question } from 'zx';
import { CloudWatchService } from './services/CloudWatchService.js';
import { DateService } from './services/DateService.js';
import {
  generateSelectList,
  createProcessOutException,
  ynRead,
} from './services/UtilService.js';
import * as dotenv from "dotenv"
dotenv.config()

const cloudWatchService = new CloudWatchService();

const setKeyWord = async (): Promise<void> => {
  if (!cloudWatchService.keyWord) {
    cloudWatchService.keyWord = await question('検索キーワードを入力してください: ');
  } else {
    const keyChange = await ynRead('検索キーワードを変更しますか？ ');
    if (keyChange === 'yes') {
      cloudWatchService.keyWord = await question(`検索キーワードを入力してください(現在の設定値: ${cloudWatchService.keyWord}): `);
    }
  }
}

const setRange = async (): Promise<void> => {
  if (!cloudWatchService.searchFrom) {
    cloudWatchService.searchFrom = await question('検索期間の開始日をyyyy-mm-dd hh:mm:ssの形式で入力してください: ');
  } else {
    const keyChange = await ynRead('検索期間の開始日を変更しますか？ ');
    if (keyChange === 'yes') {
      cloudWatchService.searchFrom = await question(`検索期間の開始日をyyyy-mm-dd hh:mm:ssの形式で入力してください(現在の設定値: ${cloudWatchService.searchFrom}): `);
    }
  }
  if (!cloudWatchService.searchTo) {
    cloudWatchService.searchTo = await question('検索期間の終了日をyyyy-mm-dd hh:mm:ssの形式で入力してください: ');
  } else {
    const keyChange = await ynRead('検索期間の終了日を変更しますか？ ');
    if (keyChange === 'yes') {
      cloudWatchService.searchTo = await question(`検索期間の終了日をyyyy-mm-dd hh:mm:ssの形式で入力してください(現在の設定値: ${cloudWatchService.searchTo}): `);
    }
  }
}

const setSince = async (): Promise<void> => {
  if (!cloudWatchService.sinceOfTail) {
    cloudWatchService.sinceOfTail = await question('--sinceの期間を設定 e.g. 1w, 1d, 1h, 1m, 1s: ');
  } else {
    const keyChange = await ynRead('期間を変更しますが？ ');
    if (keyChange === 'yes') {
      cloudWatchService.sinceOfTail = await question(`--sinceの期間を設定(現在の設定値: ${cloudWatchService.sinceOfTail}) e.g. 1w, 1d, 1h, 1m, 1s: `);
    }
  }

  if (!cloudWatchService.sinceOfTail.match(/^\d{1,2}[wdhms]$/g)) {
    throw `invalid input type. e.g. 1w, 1d, 1h, 1m, 1s`;
  }
}

const switchMethod = async (group: string, method: string): Promise<any> => {

  if (method === 'tailFollow') {
    return await cloudWatchService.follow(group);
  } else if (method === 'tail') {
    await setSince();
    return await cloudWatchService.goBackInTime(group);
  } else if (method === 'keySearch') {
    await setKeyWord();
    $.verbose = false;
    const result = await cloudWatchService.keySearch(group);
    $.verbose = true;
    console.log(result);
    if (cloudWatchService.errorCount) {
      console.log(`検索結果で${cloudWatchService.errorCount}件のエラーを検出しました`);
    }
    return result;
  } else if (method === 'rangeSearch') {
    await setRange();
    $.verbose = false;
    const result = await cloudWatchService.rangeSearch(group);
    $.verbose = true;
    console.log(result);
    if (cloudWatchService.errorCount) {
      console.log(`検索結果で${cloudWatchService.errorCount}件のエラーを検出しました`);
    }
    return result;
  } else if (method === 'keyAndRangeSearch') {
    await setKeyWord();
    await setRange();
    $.verbose = false;
    const result = await cloudWatchService.keyAndRangeSearch(group);
    $.verbose = true;
    console.log(result);
    if (cloudWatchService.errorCount) {
      console.log(`検索結果で${cloudWatchService.errorCount}件のエラーを検出しました`);
    }
    return result;
  } else if (method === 'onErrorExcludeIdSearch') {
    if (!cloudWatchService.errorCount) {
      console.log('エラーは検出されていません');
      return 1;
    }
    console.log(cloudWatchService.onErrorExecutionIds);
    const ids = await question(`executionIdを選択（上記から値を入力。複数の場合はスペース区切りで入力): `);
    //"?\"d6521fa6-5e45-4c9b-9f00-1a8b3b5065dc\" ?\"ab6119a5-f022-4ca2-bd3c-249f36e15edd\""
    const escapeKey = ids.split(' ').map((v: any) => '?' +  '\"' + v +  '\"').join(' ');
    return await cloudWatchService.onErrorExcludeIdSearch(group, escapeKey);
  }
}

const methodController = async (
  group: string,
  methods: { ps3: string, list: string[] }
) => {

  const method = await generateSelectList(methods.ps3, methods.list);
  if (method === 'exit') {
    return 1;
  }
  await switchMethod(group, method);
  await methodController(group, methods);
}

void(async function(): Promise<void> {

  try {

    $.verbose = false;
    const groups = await cloudWatchService.getLogGroups();
    $.verbose = true;

    if (!groups.length) {
      const errorMessage = 'Cannot find log group. please set .env';
      throw createProcessOutException(errorMessage);
    }

    const ps3 = 'ロググループを選択してください: '
    const group = await generateSelectList(ps3, groups);

    await methodController(group, cloudWatchService.methodOptions);

    await $`exit 1`;

  } catch (processOutput) {
    console.error(processOutput)
  }
})();


// 2022-10-19T04:51:28.355000+00:00 2022/10/19/[$LATEST]06e2cdc6fc0f4b268a0ed15e0526713b 2022-10-19T04:51:28.355Z	d6521fa6-5e45-4c9b-9f00-1a8b3b5065dc	ERROR	[
//   ValidationError {
//     property: 'instance',
//     message: 'is not of a type(s) object',
//     schema: { type: 'object', required: [Array], properties: [Object] },
//     instance: [
//       [Object], [Object], [Object],
//       [Object], [Object], [Object],
//       [Object], [Object], [Object],
//       [Object], [Object], [Object],
//       [Object], [Object], [Object],
//       [Object], [Object], [Object],
//       [Object], [Object], [Object],
//       [Object], [Object], [Object]
//     ],
//     name: 'type',
//     argument: [ 'object' ],
//     stack: 'instance is not of a type(s) object'
//   }
// ]
// 2022-10-19T04:51:28.355000+00:00 2022/10/19/[$LATEST]06e2cdc6fc0f4b268a0ed15e0526713b 2022-10-19T04:51:28.355Z	d6521fa6-5e45-4c9b-9f00-1a8b3b5065dc	INFO	SENTRY LOG invalid schema. please check json schema {
//   fileStatus: {
//     error: {
//       reason: 'invalid schema. please check json schema',
//       param: 'rom_patch'
//     },
//     result: false,
//     isScheduled: false
//   },
//   key: 'shared/import/ncms/roms/PATCH/rating.json'
// }
// 2022-10-19T04:51:28.416000+00:00 2022/10/19/[$LATEST]06e2cdc6fc0f4b268a0ed15e0526713b END RequestId: d6521fa6-5e45-4c9b-9f00-1a8b3b5065dc