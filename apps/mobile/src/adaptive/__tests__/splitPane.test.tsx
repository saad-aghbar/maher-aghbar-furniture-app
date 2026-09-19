import { useEffect } from 'react';
import { Text } from 'react-native';
import { renderAdaptive } from '@/test/adaptiveHarness';
import { SplitPane, SplitPaneAside, SplitPanePlaceholder } from '../SplitPane';

function Primary() {
  return <Text testID="primary-content">list</Text>;
}
function Detail() {
  return <Text testID="detail-content">detail</Text>;
}

describe('SplitPane', () => {
  it('renders only the primary pane when split is off (compact phone flow)', async () => {
    const view = await renderAdaptive(
      <SplitPane testID="sp" split={false} primary={<Primary />} detail={<Detail />} />,
      { width: 390 },
    );
    expect(view.getByTestId('primary-content')).toBeTruthy();
    expect(view.queryByTestId('detail-content')).toBeNull();
    expect(view.queryByTestId('sp-detail')).toBeNull();
  });

  it('renders primary | detail side by side when split is on', async () => {
    const view = await renderAdaptive(
      <SplitPane testID="sp" split primary={<Primary />} detail={<Detail />} />,
      { width: 1440 },
    );
    expect(view.getByTestId('primary-content')).toBeTruthy();
    expect(view.getByTestId('detail-content')).toBeTruthy();
    const row = view.getByTestId('sp');
    expect(row.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ flexDirection: 'row' })]),
    );
  });

  it('reverses pane order for RTL locales so primary stays at the reading start', async () => {
    const view = await renderAdaptive(
      <SplitPane testID="sp" split primary={<Primary />} detail={<Detail />} />,
      { width: 1440, locale: 'ar' },
    );
    const row = view.getByTestId('sp');
    expect(row.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ flexDirection: 'row-reverse' })]),
    );
  });

  it('shows the placeholder when nothing is selected and never a blank pane', async () => {
    const view = await renderAdaptive(
      <SplitPane
        testID="sp"
        split
        primary={<Primary />}
        detail={null}
        detailPlaceholder={
          <SplitPanePlaceholder testID="ph" title="Choose an order" body="Pick one" />
        }
      />,
      { width: 1024 },
    );
    expect(view.getByTestId('ph')).toBeTruthy();
    expect(view.getByText('Choose an order')).toBeTruthy();
  });

  it('keeps the primary pane mounted across a resize that toggles the split', async () => {
    let mounts = 0;
    function Counting() {
      useEffect(() => {
        mounts += 1;
      }, []);
      return <Text testID="counting">x</Text>;
    }
    function Host({ split }: { split: boolean }) {
      return <SplitPane split={split} primary={<Counting />} detail={<Detail />} />;
    }
    const view = await renderAdaptive(<Host split={false} />, { width: 390 });
    expect(mounts).toBe(1);
    await view.rerenderUi(<Host split />);
    await view.rerenderUi(<Host split={false} />);
    await view.rerenderUi(<Host split />);
    expect(mounts).toBe(1);
    expect(view.getByTestId('counting')).toBeTruthy();
  });

  it('pads the third pane off the status bar and the window edge', async () => {
    const view = await renderAdaptive(
      <SplitPane
        testID="sp"
        split
        primary={<Primary />}
        detail={<Detail />}
        secondary={
          <SplitPaneAside testID="aside">
            <Text testID="aside-content">readiness</Text>
          </SplitPaneAside>
        }
      />,
      { width: 1440 },
    );
    expect(view.getByTestId('aside-content')).toBeTruthy();
    expect(view.getByTestId('aside').props.contentContainerStyle).toEqual(
      expect.objectContaining({ paddingTop: 47 + 16, paddingHorizontal: 16 }),
    );
  });

  it('honours a fixed primary width', async () => {
    const view = await renderAdaptive(
      <SplitPane testID="sp" split primaryWidth={420} primary={<Primary />} detail={<Detail />} />,
      { width: 1440 },
    );
    expect(view.getByTestId('sp-primary').props.style).toEqual(
      expect.objectContaining({ width: 420 }),
    );
  });
});
