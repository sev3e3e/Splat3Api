import dayjs from 'dayjs';
import SplatNet3Api from 'nxapi/splatnet3';
import { ValueCache } from '../cache/Cache.js';
import { Auth } from './Auth.js';
import {
    SalmonRunSchedule,
    Schedule,
    scheduleCredentialRemover,
    StageSchedule,
} from './data/credentialRemovers/ScheduleCredentialRemover.js';

class Splatnet3Client {
    apiClient!: SplatNet3Api;
    constructor() {}

    async initialize() {
        const api = await Auth.initialize();

        // api.onTokenExpired = async (res: Response) => {
        //     const coralAuthData = await ValueCache.get('');
        // };

        this.apiClient = api;
    }

    // TODO: 2023/02/01 キャッシュ実装 TTLより前に更新するようにする
    async getAllSchedules() {
        // Schedulesをキャッシュ
        // TTLが残り10 * 60になったら更新したい

        // check caches
        const cache = await ValueCache.get('Schedules');

        // cacheがnullか、TTLが指定よりも小さかったら更新する
        if (cache == null || cache.TTL <= 600) {
            const schedules = await this.apiClient.getSchedules();

            // 最終スケジュールの終わり == データがもうない限界をTTLとする
            const endTime =
                schedules.data.bankaraSchedules.nodes[schedules.data.bankaraSchedules.nodes.length - 1].endTime;

            const removed = scheduleCredentialRemover.removeAllCredentials(schedules.data);

            // credentialを消したデータをキャッシュする
            await ValueCache.set('Schedules', removed, dayjs(endTime).diff(dayjs(), 'second'));

            return removed;
        }

        // キャッシュがあってTTLも十分であればそのままキャッシュを返す
        return JSON.parse(cache.value) as StageSchedule;
    }

    async getOpenBankaraSchedules() {
        // check caches
        const cache = await ValueCache.get('Schedules');

        if (cache == null) {
            const schedules = await this.apiClient.getSchedules();

            const converted = scheduleCredentialRemover.removeBankaraScheduleCredentials(
                schedules.data.bankaraSchedules
            );

            // TTL設定
            // 最新のスケジュールの終了をTTL
            // 0以下になったらキャッシュしない
            const diff = dayjs(converted.open[0].endTime).diff(dayjs(), 'second');

            if (diff > 0) {
                await ValueCache.set('Schedules', schedules, diff);
            }

            return converted.open;
        } else {
            return JSON.parse(cache.value) as Schedule[];
        }
    }

    async getChallengeBankaraSchedules() {
        // check caches
        const cache = await ValueCache.get('Schedules');

        if (cache == null) {
            const schedules = await this.apiClient.getSchedules();

            const converted = scheduleCredentialRemover.removeBankaraScheduleCredentials(
                schedules.data.bankaraSchedules
            );

            // TTL設定
            // 最新のスケジュールの終了をTTL
            // 0以下になったらキャッシュしない
            const diff = dayjs(converted.challenge[0].endTime).diff(dayjs(), 'second');

            if (diff > 0) {
                await ValueCache.set('Schedules', schedules, diff);
            }

            return converted.challenge;
        } else {
            return JSON.parse(cache.value) as Schedule[];
        }
    }

    async getSalmonRunSchedules(): Promise<SalmonRunSchedule[]> {
        const cache = await ValueCache.get('Schedules');

        if (cache == null) {
            const schedules = await this.apiClient.getSchedules();

            const salmonRunSchedules = scheduleCredentialRemover.removeSalmonRunScheduleCredentials(
                schedules.data.coopGroupingSchedule
            );

            const diff = dayjs(salmonRunSchedules[0].startTime).diff(dayjs(), 'second');

            if (diff > 0) {
                await ValueCache.set('Schedules', schedules, diff);
            }

            return salmonRunSchedules;
        } else {
            const schedules = JSON.parse(cache.value);

            return schedules;
        }
    }
}

const _splatnet3ApiClient = new Splatnet3Client();

await _splatnet3ApiClient.initialize();

export const splatnet3ApiClient = _splatnet3ApiClient;
