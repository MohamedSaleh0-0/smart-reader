import { describe, expect, it } from 'vitest';
import { addPassageLinkTrayItemsToGroup, createPassageLinkGroup, emptyPassageLinkWorkspace, removePassageLinkGroupMember, togglePassageLinkTrayItem } from './passage-links';
import type { PassageLinkGroup, PassageLinkTrayItem } from './types';

function trayItem(id: string, bookId: string, passageId: string): PassageLinkTrayItem {
  return { id, bookId, bookTitle: `Book ${bookId}`, passageId, pageNumber: 2, pageNumberKind: 'source', quote: `Quote ${passageId}`, addedAt: '2026-10-12' };
}

describe('cross-book passage links', () => {
  it('keeps the tray unique and limits it to the latest twelve positions', () => {
    const workspace = Array.from({ length: 13 }, (_unused, index) => trayItem(`t${index}`, `b${index}`, `p${index}`))
      .reduce((current, item) => togglePassageLinkTrayItem(current, item), emptyPassageLinkWorkspace());

    expect(workspace.trayItems).toHaveLength(12);
    expect(workspace.trayItems[0].id).toBe('t1');
    expect(togglePassageLinkTrayItem(workspace, workspace.trayItems[4]).trayItems.some((item) => item.id === workspace.trayItems[4].id)).toBe(false);
  });

  it('creates a named multi-book group from selected tray items and removes those items from the tray', () => {
    const first = trayItem('t1', 'b1', 'p1');
    const second = trayItem('t2', 'b2', 'p2');
    const queued = togglePassageLinkTrayItem(togglePassageLinkTrayItem(emptyPassageLinkWorkspace(), first), second);
    const group: PassageLinkGroup = {
      id: 'g1', name: 'مقارنة', createdAt: '2026-10-12',
      members: [first, second],
    };
    const linked = createPassageLinkGroup(queued, group, ['t1', 't2']);

    expect(linked.trayItems).toEqual([]);
    expect(linked.groups[0]).toMatchObject({ name: 'مقارنة', members: [{ bookId: 'b1' }, { bookId: 'b2' }] });
  });

  it('adds queued members without duplicates and removes a group when fewer than two passages remain', () => {
    const first = trayItem('t1', 'b1', 'p1');
    const second = trayItem('t2', 'b2', 'p2');
    const third = trayItem('t3', 'b3', 'p3');
    const group: PassageLinkGroup = { id: 'g1', name: '', createdAt: 'today', members: [first, second] };
    const queued = togglePassageLinkTrayItem(emptyPassageLinkWorkspace(), third);
    const extended = addPassageLinkTrayItemsToGroup({ ...queued, groups: [group] }, 'g1', ['t3']);
    expect(extended.groups[0].members).toHaveLength(3);
    expect(extended.trayItems).toEqual([]);
    expect(removePassageLinkGroupMember(extended, 'g1', 'b1', 'p1').groups[0].members).toHaveLength(2);
    expect(removePassageLinkGroupMember({ ...extended, groups: [group] }, 'g1', 'b1', 'p1').groups).toEqual([]);
  });
});
