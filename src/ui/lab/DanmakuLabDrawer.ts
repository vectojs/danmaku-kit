import { Entity, type A11yAttributes, type IRenderer } from '@vectojs/core';
import { Button, Tabs, Text, UIComponent } from '@vectojs/ui';

import type { DanmakuKitLabels } from '../labels';
import type { DanmakuKitTheme } from '../theme';
import type { LabAvailableBounds } from './LabPanel';

export interface DanmakuLabPanel extends Entity {
  setAvailableBounds(bounds: Readonly<LabAvailableBounds>): void;
}

export interface DanmakuLabTab<TabId extends string> {
  id: TabId;
  label: string;
  panel: DanmakuLabPanel;
}

export interface DanmakuLabDrawerOptions<TabId extends string> {
  theme: Readonly<DanmakuKitTheme>;
  labels: Readonly<DanmakuKitLabels['lab']>;
  panels: ReadonlyArray<Readonly<DanmakuLabTab<TabId>>>;
  open: boolean;
  activeTab: TabId;
  onOpenChange: (open: boolean) => void;
  onActiveTabChange: (tabId: TabId) => void;
}

/**
 * The concrete container one injected panel rides in (Entity is abstract).
 * It exists so the duck-typed panel itself never becomes the node that
 * `Tabs.add()` adopts and `Entity.destroy()` tears down — see
 * {@link DanmakuLabDrawer.panelWrappers}. Pure geometry holder: it claims no
 * points of its own (children are hit-tested by the scene walk) and paints
 * nothing (the panel renders itself).
 */
class PanelSlot extends Entity {
  override isPointInside(): boolean {
    return false;
  }

  override render(_renderer: IRenderer): void {}
}

/** A placement-agnostic drawer surface that keeps injected panel instances alive. */
export class DanmakuLabDrawer<TabId extends string> extends UIComponent {
  private readonly title: Text;
  private readonly closeButton: Button;
  private readonly tabs: Tabs;
  /**
   * One real Entity per injected panel, handed to {@link Tabs} as the tab
   * content instead of the panel itself. Tabs adopts whatever content it is
   * given via `add()` on every tree sync, and `Entity.destroy()`'s leaf-first
   * teardown calls `.destroy()` on every child, so the adopted node must be a
   * well-behaved Entity even though the kit only duck-types its panels. The
   * wrapper is that contract enforcement point: the panel stays owned by the
   * wrapper for its whole life, so tab switches never re-parent it.
   */
  private readonly panelWrappers: ReadonlyMap<TabId, Entity>;
  private open: boolean;

  constructor(private readonly options: DanmakuLabDrawerOptions<TabId>) {
    super();
    if (options.panels.length === 0)
      throw new Error('DanmakuLabDrawer requires at least one panel');
    if (!options.panels.some((tab) => tab.id === options.activeTab)) {
      throw new Error('DanmakuLabDrawer activeTab must identify an injected panel');
    }

    this.title = new Text(options.labels.title, {
      font: options.theme.fontDisplay,
      color: options.theme.text,
      maxWidth: 1,
    });
    this.closeButton = new Button(options.labels.close, {
      height: 36,
      bg: options.theme.surfaceRaised,
      hoverBg: options.theme.accentHover,
      color: options.theme.text,
      font: options.theme.fontUi,
      radius: options.theme.radius,
      focusColor: options.theme.focusRing,
      onClick: () => {
        this.setOpen(false);
        options.onOpenChange(false);
      },
    });
    this.closeButton.width = Math.min(120, Math.max(72, this.closeButton.textWidth + 24));

    // Each panel rides inside its own wrapper Entity (see panelWrappers): the
    // wrapper is what Tabs adopts, so the duck-typed panel itself never
    // crosses an engine boundary that assumes Entity semantics. The wrapper
    // owns the panel permanently, so tab switches swap wrappers in and out
    // without ever re-parenting the panel.
    this.panelWrappers = new Map(
      options.panels.map((tab) => {
        const wrapper = new PanelSlot();
        wrapper.add(tab.panel);
        return [tab.id, wrapper] as const;
      }),
    );
    this.tabs = new Tabs({
      label: options.labels.title,
      tabs: options.panels.map((tab) => ({
        id: tab.id,
        label: tab.label,
        content: this.panelWrappers.get(tab.id)!,
      })),
      value: options.activeTab,
      width: 1,
      height: 1,
      tabHeight: 44,
      tabWidth: 112,
      minTabWidth: 80,
      font: options.theme.fontLabel,
      color: options.theme.textMuted,
      selectedColor: options.theme.accent,
      borderColor: options.theme.border,
      onChange: (tabId) => options.onActiveTabChange(tabId as TabId),
    });

    this.open = !options.open;
    this.setOpen(options.open);
  }

  setOpen(open: boolean): void {
    if (this.open === open) return;
    this.open = open;
    this.interactive = open;
    this.a11yHidden = !open;
    this.opacity = open ? 1 : 0;

    if (open) {
      this.add(this.title, this.closeButton, this.tabs);
    } else {
      this.remove(this.title);
      this.remove(this.closeButton);
      this.remove(this.tabs);
    }
    this.scene?.markDirty();
  }

  setActiveTab(tabId: TabId): void {
    if (!this.options.panels.some((tab) => tab.id === tabId)) return;
    if (this.tabs.value === tabId) return;
    this.tabs.value = tabId;
    this.tabs.update(0, 0);
    this.scene?.markDirty();
  }

  setAvailableBounds(bounds: Readonly<LabAvailableBounds>): void {
    this.width = Math.max(0, bounds.width);
    this.height = Math.max(0, bounds.height);
    this.x = 0;
    this.y = 0;

    const padding = 12;
    const headerHeight = 40;
    const innerWidth = Math.max(0, this.width - padding * 2);
    this.title.x = padding;
    this.title.y = padding + 8;
    this.title.setMaxWidth(Math.max(1, innerWidth - this.closeButton.width - 12));
    this.closeButton.x = Math.max(padding, this.width - padding - this.closeButton.width);
    this.closeButton.y = padding;

    this.tabs.x = padding;
    this.tabs.y = padding + headerHeight;
    this.tabs.width = innerWidth;
    this.tabs.height = Math.max(0, this.height - this.tabs.y - padding);
    const panelBounds = {
      width: innerWidth,
      height: Math.max(0, this.tabs.height - this.tabs.effectiveTabBarHeight),
    };
    for (const tab of this.options.panels) tab.panel.setAvailableBounds(panelBounds);
    this.tabs.update(0, 0);
    this.scene?.markDirty();
  }

  override destroy(): void {
    // Only the active wrapper hangs off Tabs; the inactive ones are held by
    // panelWrappers alone. Destroying every wrapper here tears down each
    // injected panel exactly once (Entity.destroy() is idempotent) and
    // detaches the active one from Tabs before super.destroy() walks the
    // remaining tree.
    for (const wrapper of this.panelWrappers.values()) wrapper.destroy();
    super.destroy();
  }

  get isOpen(): boolean {
    return this.open;
  }

  get activeTab(): TabId {
    return this.tabs.value as TabId;
  }

  override getA11yAttributes(): A11yAttributes {
    return {
      role: 'dialog',
      label: this.options.labels.title,
      pointerEvents: 'none',
    };
  }

  override render(renderer: IRenderer): void {
    if (!this.open) return;
    const forced = this.scene?.forcedColors ?? false;
    this.title.color = forced ? 'CanvasText' : this.options.theme.text;
    this.tabs.color = forced ? 'CanvasText' : this.options.theme.textMuted;
    this.tabs.selectedColor = forced ? 'Highlight' : this.options.theme.accent;
    this.tabs.borderColor = forced ? 'CanvasText' : this.options.theme.border;

    renderer.beginPath();
    renderer.roundRect(0, 0, this.width, this.height, 0);
    renderer.fill(forced ? 'Canvas' : this.options.theme.surface);
    renderer.stroke(forced ? 'CanvasText' : this.options.theme.border, 1);
  }
}
