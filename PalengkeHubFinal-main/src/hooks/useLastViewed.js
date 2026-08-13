import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@palengkehub_last_viewed';
const MAX_ITEMS = 5;

export const useLastViewed = () => {
  const [items, setItems] = useState([]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const json = await AsyncStorage.getItem(KEY);
      if (json) setItems(JSON.parse(json));
    } catch { /* silently fail */ }
  };

  const add = async (product) => {
    try {
      const existing = await AsyncStorage.getItem(KEY);
      let list = existing ? JSON.parse(existing) : [];
      // Remove if already exists, then prepend
      list = list.filter((p) => p.id !== product.id);
      list.unshift({
        id: product.id,
        name: product.name,
        image: product.image_url || product.image,
        price: product.price,
        stall_id: product.stall_id,
        stall_name: product.stall_name,
        unit: product.unit,
      });
      if (list.length > MAX_ITEMS) list = list.slice(0, MAX_ITEMS);
      await AsyncStorage.setItem(KEY, JSON.stringify(list));
      setItems(list);
    } catch { /* silently fail */ }
  };

  return { items, add, reload: load };
};