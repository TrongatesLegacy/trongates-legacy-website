// A fake OBS with state, for the dock's browser tests: a scene collection with scenes, sources, their settings and
// positions, answering the OBS WebSocket requests the dock uses and changing its state the way OBS would. Built on
// fakeObs (sim.mjs), so it runs on the real network (real-net.mjs) for a real browser.
import { fakeObs } from './sim.mjs';

const FULL = { positionX: 0, positionY: 0, scaleX: 1, scaleY: 1, rotation: 0, cropTop: 0, cropBottom: 0, cropLeft: 0, cropRight: 0, alignment: 5, boundsType: 'OBS_BOUNDS_NONE', boundsWidth: 0, boundsHeight: 0, boundsAlignment: 0, sourceWidth: 1920, sourceHeight: 1080, width: 1920, height: 1080 };

// scenes: { 'Scene name': [ { name, kind: 'browser_source' | 'game_capture' | …, settings, transform } ] }
export function obsModel(net, addr, scenes, { collection = 'Test' } = {}) {
  let uuid = 0, itemId = 0;
  const inputs = new Map(), sceneList = [];
  const byName = (n) => sceneList.find((s) => s.name === n);
  const find = (d) => (d.sceneUuid ? sceneList.find((s) => s.uuid === d.sceneUuid) : byName(d.sceneName));
  const addInput = (name, kind, settings = {}) => { const inp = { uuid: 'in-' + ++uuid, name, kind, settings: { ...settings } }; inputs.set(inp.uuid, inp); return inp; };
  const addItem = (scene, inp, transform = {}) => { const it = { sceneItemId: ++itemId, input: inp, transform: { ...FULL, ...transform }, locked: false }; scene.items.push(it); return it; };
  for (const [name, items] of Object.entries(scenes)) {
    const sc = { uuid: 'sc-' + ++uuid, name, items: [] };
    sceneList.push(sc);
    for (const x of items) addItem(sc, [...inputs.values()].find((i) => i.name === x.name) || addInput(x.name, x.kind || 'browser_source', x.settings), x.transform);
  }
  const itemOut = (it, i) => ({ sceneItemId: it.sceneItemId, sourceName: it.input.name, sourceUuid: it.input.uuid, inputKind: it.input.kind,
    sourceType: 'OBS_SOURCE_TYPE_INPUT', isGroup: false, sceneItemIndex: i, sceneItemTransform: { ...it.transform }, sceneItemLocked: it.locked, sceneItemEnabled: true });
  const item = (d) => find(d).items.find((i) => i.sceneItemId === d.sceneItemId);
  const handlers = {
    GetSceneCollectionList: () => ({ currentSceneCollectionName: collection, sceneCollections: [collection] }),
    GetSceneList: () => ({ scenes: sceneList.map((s, i) => ({ sceneName: s.name, sceneUuid: s.uuid, sceneIndex: sceneList.length - 1 - i })) }),
    GetSceneItemList: (d) => ({ sceneItems: find(d).items.map(itemOut) }),
    GetGroupSceneItemList: () => ({ sceneItems: [] }),
    GetInputSettings: (d) => ({ inputSettings: { ...inputs.get(d.inputUuid).settings }, inputKind: inputs.get(d.inputUuid).kind }),
    SetInputSettings: (d) => { const inp = inputs.get(d.inputUuid); Object.assign(inp.settings, d.inputSettings); o.broadcast('InputSettingsChanged', { inputUuid: inp.uuid, inputName: inp.name }); },
    SetSceneItemTransform: (d) => { Object.assign(item(d).transform, d.sceneItemTransform); },
    SetSceneItemLocked: (d) => { item(d).locked = d.sceneItemLocked; },
    SetSceneItemIndex: () => ({}),
    CreateInput: (d) => { const inp = addInput(d.inputName, d.inputKind, d.inputSettings); const it = addItem(byName(d.sceneName), inp); o.broadcast('InputCreated', { inputName: inp.name }); return { inputUuid: inp.uuid, sceneItemId: it.sceneItemId }; },
    CreateSceneItem: (d) => { const it = addItem(byName(d.sceneName), inputs.get(d.sourceUuid)); o.broadcast('SceneItemCreated', {}); return { sceneItemId: it.sceneItemId }; },
    RemoveInput: (d) => { for (const s of sceneList) s.items = s.items.filter((i) => i.input.uuid !== d.inputUuid); inputs.delete(d.inputUuid); o.broadcast('InputRemoved', {}); },
    GetStudioModeEnabled: () => ({ studioModeEnabled: false }),
    GetCurrentProgramScene: () => ({ sceneName: sceneList[0].name }),
    PressInputPropertiesButton: () => ({}),
  };
  const o = fakeObs(net, addr, { handlers });
  o.scenes = sceneList; o.inputs = inputs;
  o.count = (type) => o.calls.filter((c) => c[1] === type).length;
  return o;
}
