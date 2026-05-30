/**
 * TTS용: 괄호 안 한자 병기·본문 한자를 제거해 음성으로 읽지 않게 한다.
 */
export function stripHanjaForTts(text: string): string {
  return text
    .replace(/[（(][^）)]*[\u4E00-\u9FFF\u3400-\u4DBF][^）)]*[）)]/g, '')
    .replace(/[\u4E00-\u9FFF\u3400-\u4DBF]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
