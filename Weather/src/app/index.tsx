import * as Location from "expo-location";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const API_KEY = "<API_KEY>"; // Replace
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Day = {
  date: string;
  label: string;
  min: number;
  max: number;
  temp: number;
  description: string;
};

// 예보는 UTC 기준 3시간 간격이라, city.timezone(초)을 더해 현지 날짜로 묶는다.
const toDailyForecast = (json: any): Day[] => {
  const offset = json.city?.timezone ?? 0;
  const localDate = (dt: number) => new Date((dt + offset) * 1000);
  const buckets = new Map<string, any[]>();

  for (const item of json.list ?? []) {
    const key = localDate(item.dt).toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }

  return [...buckets].slice(0, 5).map(([date, items]) => {
    // 정오에 가장 가까운 항목을 그날의 대표로 삼는다.
    const noon = items.reduce((best, item) =>
      Math.abs(localDate(item.dt).getUTCHours() - 12) <
      Math.abs(localDate(best.dt).getUTCHours() - 12)
        ? item
        : best,
    );

    return {
      date,
      label: WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()],
      min: Math.min(...items.map((i) => i.main.temp_min)),
      max: Math.max(...items.map((i) => i.main.temp_max)),
      temp: noon.main.temp,
      description: noon.weather[0]?.description ?? "",
    };
  });
};

export default function HomeScreen() {
  const [city, setCity] = useState("Loading...");
  const [days, setDays] = useState<Day[]>([]);
  const [ok, setOk] = useState(true);
  const getWeather = async () => {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) {
      setOk(false);
    }
    const {
      coords: { latitude, longitude },
    } = await Location.getCurrentPositionAsync({
      accuracy: 5,
    });
    const location = await Location.reverseGeocodeAsync({
      latitude,
      longitude,
    });
    setCity(location[0]?.city ?? "Unknown");
    await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&exclude=alerts&appid=${API_KEY}&units=metric`,
    )
      .then((response) => response.json())
      .then((json) => {
        console.log(JSON.stringify(json, null, 2));
        setDays(toDailyForecast(json));
      });
  };
  useEffect(() => {
    getWeather();
  }, []);
  return (
    <View style={styles.container}>
      <View style={styles.city}>
        <Text style={styles.cityName}>{city}</Text>
      </View>
      <ScrollView
        pagingEnabled
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.weather}
      >
        {days.length === 0 ? (
          <View style={styles.loading}>
            <ActivityIndicator
              color="white"
              size="large"
              style={{ marginTop: 10 }}
            />
          </View>
        ) : (
          days.map((day) => (
            <View key={day.date} style={styles.day}>
              <Text style={styles.label}>{day.label}</Text>
              <Text style={styles.temp}>{day.temp.toFixed(1)}°</Text>
              <Text style={styles.main}>
                {Math.round(day.min)}° / {Math.round(day.max)}°
              </Text>
              <Text style={styles.description}>{day.description}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "tomato" },
  city: { flex: 1.2, justifyContent: "center", alignItems: "center" },
  cityName: {
    fontSize: 60,
    fontWeight: "500",
    textAlign: "center",
    color: "white",
  },
  weather: {},
  loading: {
    width: SCREEN_WIDTH,
    alignItems: "center",
  },
  day: {
    width: SCREEN_WIDTH,
    alignItems: "flex-start",
    paddingHorizontal: 20,
  },
  label: {
    marginTop: 40,
    fontSize: 32,
    fontWeight: "500",
    color: "white",
  },
  temp: {
    marginTop: 10,
    fontSize: 120,
    color: "white",
  },
  main: {
    marginTop: -10,
    fontSize: 44,
    color: "white",
  },
  description: {
    fontSize: 20,
    color: "white",
  },
});
