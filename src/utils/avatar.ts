/**
 * 根据 seed（用户名/id）生成确定性头像 URL
 * - 有 avatar 字段时直接使用
 * - 没有时使用 DiceBear initials 风格，以 seed 生成彩色首字母头像
 */
export function getAvatarUrl(seed?: string, avatar?: string): string {
  if (avatar) return avatar
  const s = encodeURIComponent(seed || 'user')
  return `https://api.dicebear.com/9.x/initials/svg?seed=${s}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`
}
