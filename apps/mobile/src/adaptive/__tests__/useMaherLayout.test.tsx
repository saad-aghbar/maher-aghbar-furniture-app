import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { AdaptiveSurfaceProvider } from '../AdaptiveSurfaceContext';
import { buildMaherLayout, useMaherLayout } from '../useMaherLayout';
import { WindowMetricsOverride } from '../windowMetrics';

function Probe({ surface }: { surface?: 'admin' | 'customer' | 'employee' }) {
  const layout = useMaherLayout(surface ? { surface } : undefined);
  return (
    <Text testID="probe">
      {`${layout.windowClass}|${layout.navigationMode}|${layout.columnCapacity}|${layout.width}x${layout.height}|${layout.contentDensity}`}
    </Text>
  );
}

function wrap(
  width: number,
  height: number,
  surface: 'admin' | 'customer' | 'employee' = 'admin',
  probeSurface?: 'admin' | 'customer' | 'employee',
) {
  return (
    <AdaptiveSurfaceProvider surface={surface}>
      <WindowMetricsOverride value={{ width, height }}>
        <Probe surface={probeSurface} />
      </WindowMetricsOverride>
    </AdaptiveSurfaceProvider>
  );
}

describe('buildMaherLayout', () => {
  it('derives every flag from the window class', () => {
    const wide = buildMaherLayout(1440, 900, 'admin');
    expect(wide).toMatchObject({
      windowClass: 'wide',
      isCompact: false,
      isMedium: false,
      isExpanded: false,
      isWide: true,
      isLarge: true,
      isDesk: true,
      navigationMode: 'sidebar',
      columnCapacity: 4,
      contentDensity: 'command',
      surface: 'admin',
    });
    const compact = buildMaherLayout(390, 844, 'customer');
    expect(compact).toMatchObject({
      windowClass: 'compact',
      isCompact: true,
      isLarge: false,
      isDesk: false,
      navigationMode: 'bottom',
      columnCapacity: 1,
    });
  });
});

describe('useMaherLayout', () => {
  it('reads window dimensions through the metrics seam', async () => {
    const view = await render(wrap(1024, 768));
    expect(view.getByTestId('probe').props.children).toBe('expanded|sidebar|3|1024x768|desk');
  });

  it('updates live when the window resizes (same tree, no remount)', async () => {
    const view = await render(wrap(1440, 900));
    expect(view.getByTestId('probe').props.children).toContain('wide|sidebar');

    for (const [width, expected] of [
      [1024, 'expanded|sidebar'],
      [820, 'medium|rail'],
      [390, 'compact|bottom'],
      [1440, 'wide|sidebar'],
    ] as const) {
      await view.rerender(wrap(width, 900));
      expect(view.getByTestId('probe').props.children).toContain(expected);
    }
  });

  it('honours WindowMetricsOverride and the surface context', async () => {
    const view = await render(wrap(1300, 800, 'customer'));
    expect(view.getByTestId('probe').props.children).toBe('wide|bottom|4|1300x800|command');
  });

  it('explicit surface option wins over context', async () => {
    const view = await render(wrap(1300, 800, 'customer', 'admin'));
    expect(view.getByTestId('probe').props.children).toContain('wide|sidebar');
  });
});
