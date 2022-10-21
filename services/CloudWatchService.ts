import { $ } from 'zx';
import { DateService } from './DateService.js';
import util from 'util';

export class CloudWatchService {

  private _keyWord: string;               // ログ検索に使用するキーワード
  private _searchFrom: string;            // ログの期間検索のfromの値
  private _searchTo: string;              // ログの期間検索のtoの値
  private _sinceOfTail: string;           // tailコマンドの開始場所
  private _errorCount: number;            // 検索で検知したエラー件数
  private _onErrorExecutionIds: string[]; // 検知エラーのIdを保持

  get keyWord(): string {
    return this._keyWord;
  }

  set keyWord(keyWord: string) {
    this._keyWord = keyWord;
  }

  get searchFrom(): string {
    return this._searchFrom;
  }

  set searchFrom(dateString: string) {
    this._searchFrom = dateString;
  }

  get searchTo(): string {
    return this._searchTo;
  }

  set searchTo(dateString: string) {
    this._searchTo = dateString;
  }

  get sinceOfTail(): string {
    return this._sinceOfTail;
  }

  set sinceOfTail(dateString: string) {
    this._sinceOfTail = dateString;
  }

  get errorCount(): number {
    return this._errorCount;
  }

  set errorCount(count: number) {
    this._errorCount = count;
  }

  get onErrorExecutionIds(): string[] {
    return this._onErrorExecutionIds;
  }

  set onErrorExecutionIds(ids: string[]) {
    this._onErrorExecutionIds = ids;
  }

  get methodOptions(): { ps3: string, list: string[] } {
    return {
      ps3: '実行する処理を選択してください: ',
      list: [
        'tailFollow',
        'tail',
        'keySearch',
        'rangeSearch',
        'keyAndRangeSearch',
        'onErrorExcludeIdSearch',
        'exit'
      ]
    };
  }

  // filterLogのレスポンスを整形
  private convertLog(result: any): any {
    const parseEvents = result.events
      .map((event: any) => event.message)
      .map((message: any) => {

        let timestamp, executionId, msg;

        if (message.startsWith('START RequestId:') || message.startsWith('END RequestId:')) {
          const parse = message.split(' ');
          timestamp = '';
          executionId = parse[2].split(/\t|\n/g).filter((v: any) => v !== '')[0];
          msg = message.split(/\t|\n/g);
        } else if (message.startsWith('REPORT RequestId:')) {
          [ timestamp, executionId, ...msg] = message.split(/\t|\n/g);
          const _executionId = timestamp.split(' ')[2];
          msg.unshift(executionId);
          msg.unshift(timestamp);
          executionId = _executionId;
          timestamp = '';
        } else {
          [ timestamp, executionId, ...msg] = message.split(/\t|\n/g);
        }

        return {
          timestamp: timestamp,
          executionId: executionId,
          arrayMessage: msg.filter((v: any) => v !== ''),
        }
      });

      return util.inspect(parseEvents, { maxArrayLength: null })
  }

  // filterLogのレスポンス結果の内エラー文言を含むexecutionIdデータに絞る
  private setOnErrorExecutionIds(result: any) {
    const filterError = result.events
      .map((event: any) => event.message)
      .filter((message: any) => message.indexOf('ERROR') !== -1 || message.indexOf('Error') !== -1 || message.indexOf('error') !== -1)
      .map((errorMessages: any) => {
        let timestamp, executionId, msg;
        [ timestamp, executionId, ...msg] = errorMessages.split(/\t|\n/g);
        return executionId;
      })
      .filter((onErrorId: any, index: any, self: any) => self.indexOf(onErrorId) === index);

    this.errorCount = filterError.length;
    this.onErrorExecutionIds = filterError;
  }

  /**
   * 指定prefixのロググループ一覧を取得
   * $ aws logs describe-log-groups --log-group-name-prefix GROUP_PREFIX --profile PROFILE_NAME
   * @link https://awscli.amazonaws.com/v2/documentation/api/latest/reference/logs/describe-log-groups.html
   */
  async getLogGroups(): Promise<string[]> {

    const options = [
      '--log-group-name-prefix',
      process.env.LOG_PREFIX,
      '--profile',
      process.env.AWS_PROFILE,
    ];

    const groups = JSON.parse((await $`aws logs describe-log-groups ${options}`).toString());
    return groups?.logGroups
      .map((v: any) => v.logGroupName)
      .filter((v: any) => v.indexOf(process.env.SLS_STAGE) !== -1)
      ?? [];
  }

  /**
   * ログの履歴を出力する
   * @link https://awscli.amazonaws.com/v2/documentation/api/latest/reference/logs/tail.html
   */
  private async tail(options: any): Promise<any> {
    console.log('options', options);
    return await $`aws logs tail ${options}`;
  }

  /**
   * ログの検索を行う
   * @link https://awscli.amazonaws.com/v2/documentation/api/latest/reference/logs/filter-log-events.html
   */
  private async filterLog(options: any): Promise<any> {
    console.log('options', options);
    const result = await $`aws logs filter-log-events ${options}`;

    this.setOnErrorExecutionIds(JSON.parse(result.toString()));
    return this.convertLog(JSON.parse(result.toString()));
  }

  /**
   * ログのリアルタイム監視を行う
   * aws logs tail --follow LOG_GROUP --profile PROFILE_NAME
   */
  async follow(logGroup: string): Promise<any> {

    const options = [
      '--follow',
      logGroup,
      '--profile',
      process.env.AWS_PROFILE,
    ];

    return await this.tail(options);
  }

  /**
   * ログ履歴を指定時間前から表示する
   * aws logs tail LOG_GROUP --since SINCE_KEY --profile PROFILE_NAME
   */
  async goBackInTime(logGroup: string): Promise<any> {

    const options = [
      logGroup,
      '--since',
      this.sinceOfTail,
      '--profile',
      process.env.AWS_PROFILE,
    ];

    return await this.tail(options);
  }

  /**
   * キーワードログ検索のオプション設定。待機長くなるから1日で絞る
   * aws logs filter-log-events --log-group-name LOG_GROUP --filter-pattern KEY_WORD --profile PROFILE_NAME
   */
  async keySearch(logGroup: string): Promise<any> {

    const options = [
      '--log-group-name',
      logGroup,
      '--filter-pattern',
      this.keyWord,
      '--start-time',
      DateService.getPastUtcTimestamp(1, 'd'),
      '--profile',
      process.env.AWS_PROFILE,
    ];

    return await this.filterLog(options);
  }

  /**
   * 開始日と終了日で絞って検索する
   * aws logs filter-log-events --log-group-name LOG_GROUP --start-time 1666018800000 --end-time 1666105200000 --filter-pattern KEY_WORD --profile PROFILE_NAME
   */
  async rangeSearch(logGroup: string): Promise<any> {

    const options = [
      '--log-group-name',
      logGroup,
      '--start-time',
      DateService.getUtcTimestampFromJstDateString(this.searchFrom),
      '--end-time',
      DateService.getUtcTimestampFromJstDateString(this.searchTo),
      '--profile',
      process.env.AWS_PROFILE,
    ];

    return await this.filterLog(options);
  }

  /**
   * 開始日と終了日とキーワードで絞って検索する
   * aws logs filter-log-events --log-group-name LOG_GROUP --start-time 1666018800000 --end-time 1666105200000 --profile PROFILE_NAME
   */
  async keyAndRangeSearch(logGroup: string): Promise<any> {

    const options = [
      '--log-group-name',
      logGroup,
      '--start-time',
      DateService.getUtcTimestampFromJstDateString(this.searchFrom),
      '--end-time',
      DateService.getUtcTimestampFromJstDateString(this.searchTo),
      '--filter-pattern',
      this.keyWord,
      '--profile',
      process.env.AWS_PROFILE,
    ];

    return await this.filterLog(options);
  }

  async onErrorExcludeIdSearch(logGroup: string, ids: string) {

    const options: any = [
      '--log-group-name',
      logGroup,
      '--filter-pattern',
      ids,
      '--profile',
      process.env.AWS_PROFILE,
    ];

    if (this.searchFrom) {
      options.push('--start-time', DateService.getUtcTimestampFromJstDateString(this.searchFrom));
      if (this.searchTo) {
        options.push('--end-time', DateService.getUtcTimestampFromJstDateString(this.searchTo));
      }
    }

    return await this.filterLog(options);
  }
}
