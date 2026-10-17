import type { PassageLinkGroup, PassageLinkMember, PassageLinkTrayItem, PassageLinkWorkspace } from './types';

export function emptyPassageLinkWorkspace(): PassageLinkWorkspace {
  return { id: 'library-links', trayItems: [], groups: [] };
}

export function normalizePassageLinkWorkspace(value?: Partial<PassageLinkWorkspace> | null): PassageLinkWorkspace {
  return {
    id: 'library-links',
    trayItems: Array.isArray(value?.trayItems) ? value.trayItems.slice(-12) : [],
    groups: Array.isArray(value?.groups) ? value.groups.filter((group) => Array.isArray(group.members) && group.members.length >= 2) : [],
  };
}

function sameMember(left: Pick<PassageLinkMember, 'bookId' | 'passageId'>, right: Pick<PassageLinkMember, 'bookId' | 'passageId'>) {
  return left.bookId === right.bookId && left.passageId === right.passageId;
}

export function togglePassageLinkTrayItem(workspace: PassageLinkWorkspace, item: PassageLinkTrayItem): PassageLinkWorkspace {
  const existing = workspace.trayItems.find((candidate) => sameMember(candidate, item));
  return {
    ...workspace,
    trayItems: existing
      ? workspace.trayItems.filter((candidate) => !sameMember(candidate, item))
      : [...workspace.trayItems, item].slice(-12),
  };
}

export function removePassageLinkTrayItem(workspace: PassageLinkWorkspace, itemId: string): PassageLinkWorkspace {
  return { ...workspace, trayItems: workspace.trayItems.filter((item) => item.id !== itemId) };
}

export function createPassageLinkGroup(
  workspace: PassageLinkWorkspace,
  group: PassageLinkGroup,
  trayItemIds: readonly string[],
): PassageLinkWorkspace {
  const members = group.members.filter((member, index, all) => all.findIndex((candidate) => sameMember(candidate, member)) === index);
  if (members.length < 2) return workspace;
  const selected = new Set(trayItemIds);
  return {
    ...workspace,
    groups: [...workspace.groups, { ...group, members }],
    trayItems: workspace.trayItems.filter((item) => !selected.has(item.id)),
  };
}

export function addPassageLinkTrayItemsToGroup(
  workspace: PassageLinkWorkspace,
  groupId: string,
  trayItemIds: readonly string[],
): PassageLinkWorkspace {
  const selected = new Set(trayItemIds);
  const additions = workspace.trayItems.filter((item) => selected.has(item.id));
  if (!additions.length) return workspace;
  return {
    ...workspace,
    groups: workspace.groups.map((group) => group.id === groupId
      ? { ...group, members: [...group.members, ...additions.filter((item) => !group.members.some((member) => sameMember(member, item)))] }
      : group),
    trayItems: workspace.trayItems.filter((item) => !selected.has(item.id)),
  };
}

export function renamePassageLinkGroup(workspace: PassageLinkWorkspace, groupId: string, name: string): PassageLinkWorkspace {
  const value = name.trim();
  if (!value) return workspace;
  return { ...workspace, groups: workspace.groups.map((group) => group.id === groupId ? { ...group, name: value } : group) };
}

export function removePassageLinkGroup(workspace: PassageLinkWorkspace, groupId: string): PassageLinkWorkspace {
  return { ...workspace, groups: workspace.groups.filter((group) => group.id !== groupId) };
}

export function removePassageLinkGroupMember(workspace: PassageLinkWorkspace, groupId: string, bookId: string, passageId: string): PassageLinkWorkspace {
  const groups = workspace.groups.flatMap((group) => {
    if (group.id !== groupId) return [group];
    const members = group.members.filter((member) => !sameMember(member, { bookId, passageId }));
    return members.length >= 2 ? [{ ...group, members }] : [];
  });
  return { ...workspace, groups };
}
