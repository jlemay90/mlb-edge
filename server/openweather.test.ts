import { describe, expect, it } from "vitest";
import axios from "axios";

describe("OpenWeather API Key Validation", () => {
  it("should connect to OpenWeather API with the provided key", async () => {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    expect(apiKey, "OPENWEATHER_API_KEY must be set").toBeTruthy();

    // Test with Yankee Stadium coordinates (New York)
    const response = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?lat=40.8296&lon=-73.9262&appid=${apiKey}&units=imperial`,
      { timeout: 10000 }
    );

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty("main");
    expect(response.data).toHaveProperty("wind");
    expect(response.data.main).toHaveProperty("temp");
    expect(response.data.wind).toHaveProperty("speed");
    console.log(
      `✅ OpenWeather API working — Yankee Stadium: ${response.data.main.temp}°F, wind ${response.data.wind.speed} mph`
    );
  }, 15000);
});
