import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, ScrollView,
  ActivityIndicator, RefreshControl, StyleSheet, Alert, SafeAreaView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { api, loadConfig, saveConfig, clearConfig } from './src/api';

const rp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const fmtDate = (s) => (s ? new Date(s).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '');
const iso = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };

const RANGES = [['Hari ini', 0], ['7 hari', 7], ['30 hari', 30]];
const TYPES = [['Semua', ''], ['Masuk', 'CREDIT'], ['Keluar', 'DEBIT']];

function Login({ onDone }) {
  const [url, setUrl] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      await saveConfig(url, pw);
      await api('/ping');
      onDone();
    } catch (e) {
      await clearConfig();
      Alert.alert('Gagal masuk', e.message);
    } finally { setBusy(false); }
  };
  return (
    <SafeAreaView style={s.center}>
      <Text style={s.title}>Mutasi</Text>
      <TextInput style={s.input} placeholder="Alamat server (https://...)" autoCapitalize="none"
        value={url} onChangeText={setUrl} />
      <TextInput style={s.input} placeholder="Kata sandi" secureTextEntry value={pw} onChangeText={setPw} />
      <TouchableOpacity style={s.btn} onPress={go} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnT}>Masuk</Text>}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const Chip = ({ label, active, onPress }) => (
  <TouchableOpacity onPress={onPress} style={[s.chip, active && s.chipOn]}>
    <Text style={[s.chipT, active && { color: '#fff' }]}>{label}</Text>
  </TouchableOpacity>
);

function Main({ onLogout }) {
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState('');
  const [range, setRange] = useState(7);
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async (p = 1) => {
    setLoading(true); setErr('');
    try {
      const r = await api('/mutations', {
        params: { accountId, type, search, page: p, limit: 20, startDate: daysAgo(range), endDate: iso(new Date()) },
      });
      setItems((prev) => (p === 1 ? r.data || [] : [...prev, ...(r.data || [])]));
      setPage(p);
      setMore(!!r.pagination?.hasMore || (r.pagination && p < r.pagination.totalPages));
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, [accountId, type, search, range]);

  useEffect(() => {
    api('/accounts').then((r) => setAccounts(Array.isArray(r.data) ? r.data : [])).catch((e) => setErr(e.message));
  }, []);
  useEffect(() => { load(1); }, [load]);

  const refresh = async () => {
    if (!accountId) return Alert.alert('Pilih satu akun dulu untuk refresh');
    try { await api(`/accounts/${accountId}/refresh`, { method: 'POST' }); await load(1); }
    catch (e) { Alert.alert('Gagal refresh', e.message); }
  };

  const totalIn = items.filter((i) => i.type === 'CREDIT').reduce((a, i) => a + i.amount, 0);
  const totalOut = items.filter((i) => i.type === 'DEBIT').reduce((a, i) => a + i.amount, 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f5f6f8' }}>
      <View style={s.header}>
        <Text style={s.title2}>Mutasi</Text>
        <TouchableOpacity onPress={onLogout}><Text style={{ color: '#c0392b' }}>Keluar</Text></TouchableOpacity>
      </View>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
          <Chip label="Semua akun" active={!accountId} onPress={() => setAccountId('')} />
          {accounts.map((a) => (
            <Chip key={a.id} label={`${a.name || a.phoneNumber} · ${a.providerCode}`}
              active={accountId === a.id} onPress={() => setAccountId(a.id)} />
          ))}
        </ScrollView>
        <View style={s.row}>
          {RANGES.map(([l, d]) => <Chip key={l} label={l} active={range === d} onPress={() => setRange(d)} />)}
          {TYPES.map(([l, t]) => <Chip key={l} label={l} active={type === t} onPress={() => setType(t)} />)}
        </View>
        <View style={[s.row, { paddingTop: 0 }]}>
          <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} placeholder="Cari keterangan"
            value={search} onChangeText={setSearch} returnKeyType="search" />
          <TouchableOpacity style={[s.btn, { marginLeft: 8, paddingHorizontal: 14 }]} onPress={refresh}>
            <Text style={s.btnT}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={s.sum}>
        <Text style={{ color: '#1e8e3e' }}>Masuk {rp(totalIn)}</Text>
        <Text style={{ color: '#c0392b' }}>Keluar {rp(totalOut)}</Text>
      </View>
      {!!err && <Text style={s.err}>{err}</Text>}
      <FlatList
        data={items}
        keyExtractor={(i, idx) => `${i.id}-${idx}`}
        refreshControl={<RefreshControl refreshing={loading && page === 1} onRefresh={() => load(1)} />}
        onEndReached={() => more && !loading && load(page + 1)}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={!loading && <Text style={s.empty}>Belum ada mutasi</Text>}
        renderItem={({ item }) => (
          <View style={s.item}>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={2} style={s.desc}>{item.description || '-'}</Text>
              <Text style={s.date}>{fmtDate(item.transactionDate || item.createdAt)}</Text>
            </View>
            <Text style={{ fontWeight: '700', color: item.type === 'CREDIT' ? '#1e8e3e' : '#c0392b' }}>
              {item.type === 'CREDIT' ? '+' : '-'}{rp(item.amount)}
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

export default function App() {
  const [state, setState] = useState('loading');
  useEffect(() => {
    loadConfig().then((c) => setState(c.url && c.password ? 'in' : 'out'));
  }, []);
  const logout = async () => { await clearConfig(); setState('out'); };
  return (
    <>
      <StatusBar style="dark" />
      {state === 'loading' ? <View style={s.center}><ActivityIndicator /></View>
        : state === 'in' ? <Main onLogout={logout} /> : <Login onDone={() => setState('in')} />}
    </>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f5f6f8' },
  title: { fontSize: 32, fontWeight: '700', marginBottom: 24 },
  title2: { fontSize: 22, fontWeight: '700' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 40 },
  input: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e0e3e8' },
  btn: { backgroundColor: '#1a56db', borderRadius: 10, padding: 14, alignItems: 'center', justifyContent: 'center' },
  btnT: { color: '#fff', fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center' },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: '#e6e9ee', marginRight: 6, marginBottom: 4 },
  chipOn: { backgroundColor: '#1a56db' },
  chipT: { color: '#333', fontSize: 13 },
  sum: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8 },
  item: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 12, marginBottom: 8, padding: 12, borderRadius: 10 },
  desc: { fontSize: 14, marginBottom: 2, paddingRight: 8 },
  date: { fontSize: 12, color: '#777' },
  err: { color: '#c0392b', textAlign: 'center', padding: 8 },
  empty: { textAlign: 'center', color: '#888', marginTop: 40 },
});
