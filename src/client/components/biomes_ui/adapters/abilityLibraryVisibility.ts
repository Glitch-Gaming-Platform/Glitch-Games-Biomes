export function abilityVisibleInBiomesLibraryForTest(ability: any): boolean {
  if (!ability) {
    return false;
  }
  if (ability.known || ability.unlocked) {
    return true;
  }
  if (ability.businessTypeId) {
    return ability.businessUnlocked === true;
  }
  return false;
}
