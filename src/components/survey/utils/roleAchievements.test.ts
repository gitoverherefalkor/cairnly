import { describe, it, expect } from 'vitest';
import {
  resolveRoleAchievementTexts,
  applyRoleAchievementEdit,
  applyOtherAchievementEdit,
  getOtherAchievementText,
  type RoleSlot,
  type CompanyAchievement,
} from './roleAchievements';

describe('resolveRoleAchievementTexts', () => {
  it('maps distinct companies to their own entries', () => {
    const roles: RoleSlot[] = [
      { company: 'Acme', yearRange: '2020–2022' },
      { company: 'Globex', yearRange: '2018–2020' },
    ];
    const stored: CompanyAchievement[] = [
      { company: 'Acme', yearRange: '', text: 'Shipped X' },
      { company: 'Globex', yearRange: '', text: 'Grew Y' },
    ];
    expect(resolveRoleAchievementTexts(roles, stored)).toEqual(['Shipped X', 'Grew Y']);
  });

  it('is case-insensitive on company name', () => {
    const roles: RoleSlot[] = [{ company: 'ACME', yearRange: '2020–2022' }];
    const stored: CompanyAchievement[] = [{ company: 'acme', yearRange: '', text: 'Won' }];
    expect(resolveRoleAchievementTexts(roles, stored)).toEqual(['Won']);
  });

  // The core bug: two roles at the same company must NOT both show the same text.
  it('gives the grouped CV text to the first same-company role and empties the rest', () => {
    const roles: RoleSlot[] = [
      { company: 'Acme', yearRange: '2015–2018' },
      { company: 'Acme', yearRange: '2018–2022' },
    ];
    const stored: CompanyAchievement[] = [
      { company: 'Acme', yearRange: '', text: 'Led the team' },
    ];
    expect(resolveRoleAchievementTexts(roles, stored)).toEqual(['Led the team', '']);
  });

  it('maps two same-company roles to their two distinct stored entries', () => {
    const roles: RoleSlot[] = [
      { company: 'Acme', yearRange: '2015–2018' },
      { company: 'Acme', yearRange: '2018–2022' },
    ];
    const stored: CompanyAchievement[] = [
      { company: 'Acme', yearRange: '2015–2018', text: 'First stint win' },
      { company: 'Acme', yearRange: '2018–2022', text: 'Second stint win' },
    ];
    expect(resolveRoleAchievementTexts(roles, stored)).toEqual([
      'First stint win',
      'Second stint win',
    ]);
  });

  it('resolves empty when no stored entry matches', () => {
    const roles: RoleSlot[] = [{ company: 'Newco', yearRange: '2023–Present' }];
    expect(resolveRoleAchievementTexts(roles, [])).toEqual(['']);
  });
});

describe('applyRoleAchievementEdit', () => {
  const sameCompanyRoles: RoleSlot[] = [
    { company: 'Acme', yearRange: '2015–2018' },
    { company: 'Acme', yearRange: '2018–2022' },
  ];

  it('editing the second same-company role does not touch the first', () => {
    const stored: CompanyAchievement[] = [
      { company: 'Acme', yearRange: '', text: 'Led the team' },
    ];
    const next = applyRoleAchievementEdit(sameCompanyRoles, stored, 1, 'Owned the migration');
    // First role keeps the CV text, second role gets its own text.
    expect(resolveRoleAchievementTexts(sameCompanyRoles, next)).toEqual([
      'Led the team',
      'Owned the migration',
    ]);
  });

  it('editing the first same-company role does not touch the second', () => {
    const stored: CompanyAchievement[] = [
      { company: 'Acme', yearRange: '2015–2018', text: 'A' },
      { company: 'Acme', yearRange: '2018–2022', text: 'B' },
    ];
    const next = applyRoleAchievementEdit(sameCompanyRoles, stored, 0, 'A-edited');
    expect(resolveRoleAchievementTexts(sameCompanyRoles, next)).toEqual(['A-edited', 'B']);
  });

  it('editing the second role first (no prior entry) stays stable across a re-render', () => {
    // Nothing stored yet — user types into the second box before the first.
    const afterEdit = applyRoleAchievementEdit(sameCompanyRoles, [], 1, 'Second only');
    // Round-trip: resolving from the produced array must still isolate the roles.
    expect(resolveRoleAchievementTexts(sameCompanyRoles, afterEdit)).toEqual(['', 'Second only']);
    // ...and a follow-up edit to the first role must not disturb the second.
    const afterSecond = applyRoleAchievementEdit(sameCompanyRoles, afterEdit, 0, 'First now');
    expect(resolveRoleAchievementTexts(sameCompanyRoles, afterSecond)).toEqual([
      'First now',
      'Second only',
    ]);
  });

  it('preserves the Other bucket when editing a role', () => {
    const stored: CompanyAchievement[] = [
      { company: 'Acme', yearRange: '', text: 'Led the team' },
      { company: 'Other', yearRange: '', text: 'Volunteer work' },
    ];
    const next = applyRoleAchievementEdit(sameCompanyRoles, stored, 1, 'New');
    expect(getOtherAchievementText(next)).toBe('Volunteer work');
  });

  it('preserves orphaned entries (company no longer in the role list)', () => {
    const roles: RoleSlot[] = [{ company: 'Acme', yearRange: '2020–2022' }];
    const stored: CompanyAchievement[] = [
      { company: 'Acme', yearRange: '', text: 'Acme win' },
      { company: 'OldCo', yearRange: '', text: 'Old win' },
    ];
    const next = applyRoleAchievementEdit(roles, stored, 0, 'Acme edited');
    const oldco = next.find((a) => a.company === 'OldCo');
    expect(oldco?.text).toBe('Old win');
  });
});

describe('applyOtherAchievementEdit', () => {
  const roles: RoleSlot[] = [
    { company: 'Acme', yearRange: '2015–2018' },
    { company: 'Acme', yearRange: '2018–2022' },
  ];

  it('sets the Other text without disturbing role texts', () => {
    const stored: CompanyAchievement[] = [
      { company: 'Acme', yearRange: '2015–2018', text: 'A' },
      { company: 'Acme', yearRange: '2018–2022', text: 'B' },
    ];
    const next = applyOtherAchievementEdit(roles, stored, 'Side project');
    expect(resolveRoleAchievementTexts(roles, next)).toEqual(['A', 'B']);
    expect(getOtherAchievementText(next)).toBe('Side project');
  });

  it('clears the Other entry when text is emptied', () => {
    const stored: CompanyAchievement[] = [{ company: 'Other', yearRange: '', text: 'x' }];
    const next = applyOtherAchievementEdit([], stored, '   ');
    expect(getOtherAchievementText(next)).toBe('');
  });
});
