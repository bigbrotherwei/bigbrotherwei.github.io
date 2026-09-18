export interface TextStatistics {
  characters: number;
  charactersWithoutWhitespace: number;
  chineseCharacters: number;
  englishWords: number;
  lines: number;
  utf8Bytes: number;
}

const hanCharacter = /\p{Script=Han}/u;
const englishWord = /(?:(?!\p{Script=Han})[\p{L}\p{N}])+/gu;

export const countText = (input: string): TextStatistics => {
  const characters = Array.from(input);
  const textWithoutTerminalNewline = input.endsWith('\n') ? input.slice(0, -1) : input;

  return {
    characters: characters.length,
    charactersWithoutWhitespace: characters.filter((character) => !/\s/u.test(character)).length,
    chineseCharacters: characters.filter((character) => hanCharacter.test(character)).length,
    englishWords: Array.from(input.matchAll(englishWord)).length,
    lines: textWithoutTerminalNewline === '' ? 0 : textWithoutTerminalNewline.split(/\r?\n/u).length,
    utf8Bytes: new TextEncoder().encode(input).length,
  };
};
