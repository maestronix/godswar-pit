/**
 * Achievement evaluation.
 *
 * Achievements are checked after every run and whenever the stats change.
 * The rewards are real unlocks, not just numbers.
 */
import { Content } from '../data/registry';
import type { SaveFile } from './schema';

export interface AchievementResult {
  unlocked: string[];
  rewards: { id: string; name: string; reward: string }[];
}

/** The current value of an achievement metric. */
export function metricValue(save: SaveFile, metric: string): number {
  const stats = save.stats;
  switch (metric) {
    case 'kills':
      return stats.kills;
    case 'boss_kills':
      return stats.bossKills;
    case 'deepest_run':
      return stats.deepestRun;
    case 'items_found':
      return stats.itemsFound;
    case 'legendary_found':
      return stats.itemsFound;
    case 'runes_unlocked':
      return save.unlocked.persistent.runes.length;
    case 'thrones_claimed':
      return save.player.throneRank;
    case 'offline_seconds':
      return stats.totalOfflineSeconds;
    case 'runs_survived':
      return stats.runsFinished;
    case 'seasons_ascended':
      return save.player.incarnations;
    case 'aspects_collected':
      return save.unlocked.persistent.codex.length;
    case 'levels_reached':
      return save.player.level;
    case 'souls_earned':
      return stats.totalSoulsEarned;
    case 'nodes_visited':
      return stats.nodesVisited;
    case 'echo_earned':
      return stats.totalEchoEarned;
    case 'inheritance_earned':
      return stats.totalInheritanceEarned;
    default:
      return 0;
  }
}

/** Check all achievements and unlock the ones that are done. */
export function evaluateAchievements(save: SaveFile): AchievementResult {
  const unlocked: string[] = [];
  const rewards: { id: string; name: string; reward: string }[] = [];

  for (const achievement of Content.achievements.values()) {
    const value = metricValue(save, achievement.metric);
    save.achievements.progress[achievement.metric] = Math.max(
      save.achievements.progress[achievement.metric] ?? 0,
      value,
    );
    if (save.achievements.unlocked.includes(achievement.id)) continue;
    if (value < achievement.threshold) continue;

    save.achievements.unlocked.push(achievement.id);
    unlocked.push(achievement.id);

    switch (achievement.reward.kind) {
      case 'inheritance':
        save.player.inheritance += achievement.reward.amount;
        save.stats.totalInheritanceEarned += achievement.reward.amount;
        break;
      case 'souls':
        save.player.souls += achievement.reward.amount;
        save.stats.totalSoulsEarned += achievement.reward.amount;
        break;
      case 'echo':
        save.player.echo += achievement.reward.amount;
        save.stats.totalEchoEarned += achievement.reward.amount;
        break;
      case 'title':
        if (achievement.reward.id && !save.achievements.titles.includes(achievement.reward.id)) {
          save.achievements.titles.push(achievement.reward.id);
        }
        break;
      case 'pet':
        if (achievement.reward.id && !save.achievements.pets.includes(achievement.reward.id)) {
          save.achievements.pets.push(achievement.reward.id);
        }
        break;
      default:
        break;
    }

    rewards.push({
      id: achievement.id,
      name: achievement.name,
      reward: `${achievement.reward.amount} ${achievement.reward.kind}`,
    });
  }

  return { unlocked, rewards };
}
