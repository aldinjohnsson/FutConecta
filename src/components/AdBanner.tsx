import { useEffect, useRef, useState } from 'react';
import { Image, Linking, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, ScrollViewInstance, Text, View } from 'react-native';

import { colors } from '@/components/ui';
import { supabase } from '@/lib/supabase';

interface BannerRow {
  id: string;
  title: string | null;
  image_url: string;
  link_url: string | null;
}

/** Carrossel de propagandas gerenciado pelo super admin. Some sozinho se não houver banners. */
export default function AdBanner() {
  const [banners, setBanners] = useState<BannerRow[]>([]);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const scroller = useRef<ScrollViewInstance>(null);

  useEffect(() => {
    supabase
      .from('banners')
      .select('id,title,image_url,link_url')
      .eq('active', true)
      .order('sort_order')
      .order('created_at', { ascending: false })
      .limit(8)
      .then(({ data }) => setBanners((data ?? []) as BannerRow[]));
  }, []);

  // troca automática a cada 5 segundos
  useEffect(() => {
    if (banners.length < 2 || !width) return;
    const t = setInterval(() => {
      setIndex((cur) => {
        const next = (cur + 1) % banners.length;
        scroller.current?.scrollTo({ x: next * width, animated: true });
        return next;
      });
    }, 5000);
    return () => clearInterval(t);
  }, [banners.length, width]);

  if (banners.length === 0) return null;

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!width) return;
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  }

  return (
    <View style={{ marginBottom: 16 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <ScrollView
          ref={scroller}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          style={{ borderRadius: 18 }}
        >
          {banners.map((b) => (
            <Pressable
              key={b.id}
              disabled={!b.link_url}
              onPress={() => b.link_url && Linking.openURL(b.link_url)}
              style={{ width, height: Math.round(width * 0.42) }}
            >
              <Image source={{ uri: b.image_url }} style={{ width, height: '100%', borderRadius: 18, backgroundColor: colors.primarySoft }} resizeMode="cover" />
              {b.title ? (
                <View style={{ position: 'absolute', left: 12, bottom: 12, backgroundColor: 'rgba(11,27,63,0.75)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 }}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{b.title}</Text>
                </View>
              ) : null}
            </Pressable>
          ))}
        </ScrollView>
      )}
      {banners.length > 1 && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 8, gap: 6 }}>
          {banners.map((b, i) => (
            <View
              key={b.id}
              style={{ width: i === index ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === index ? colors.navy : colors.border }}
            />
          ))}
        </View>
      )}
      <Text style={{ position: 'absolute', top: 8, right: 10, color: '#fff', fontSize: 10, fontWeight: '700', backgroundColor: 'rgba(0,0,0,0.35)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
        Anúncio
      </Text>
    </View>
  );
}
