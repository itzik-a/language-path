import { describe, expect, it } from "vitest";
import { cloudLang, listVoices, rankVoices, setFetchForTests, synth } from "../src/lib/cloudTts";

const RAW = [
  { name: "el-GR-Standard-B", languageCodes: ["el-GR"], ssmlGender: "FEMALE" },
  { name: "el-GR-Wavenet-B", languageCodes: ["el-GR"], ssmlGender: "FEMALE" },
  { name: "el-GR-Chirp3-HD-Charon", languageCodes: ["el-GR"], ssmlGender: "MALE" },
  { name: "el-GR-Chirp3-HD-Leda", languageCodes: ["el-GR"], ssmlGender: "FEMALE" },
  { name: "en-US-Chirp3-HD-Leda", languageCodes: ["en-US"], ssmlGender: "FEMALE" },
];

describe("Google voices", () => {
  it("ranks Chirp 3 HD first, keeps only the language, labels them", () => {
    const v = rankVoices(RAW, "el-GR");
    expect(v.map((x) => x.name)).toEqual(["el-GR-Chirp3-HD-Leda", "el-GR-Chirp3-HD-Charon", "el-GR-Wavenet-B", "el-GR-Standard-B"]);
    expect(v[0].label).toBe("Leda · Chirp 3 HD, female");
    expect(v[2].label).toBe("Wavenet B · WaveNet, female");
  });
  it("uses Google's code for Arabic", () => {
    expect(cloudLang("ar")).toBe("ar-XA");
    expect(cloudLang("pt")).toBe("pt-PT");
  });
  it("lists voices and synthesises with the key, then serves the clip from the cache", async () => {
    const calls: { url: string; body?: string }[] = [];
    setFetchForTests((async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body as string | undefined });
      const data = url.includes("/voices") ? { voices: RAW } : { audioContent: btoa("ID3fake") };
      return new Response(JSON.stringify(data), { status: 200 });
    }) as typeof fetch);
    const voices = await listVoices("el", "K123");
    expect(voices[0].name).toBe("el-GR-Chirp3-HD-Leda");
    expect(calls[0].url).toBe("https://texttospeech.googleapis.com/v1/voices?languageCode=el-GR&key=K123");

    const mp3 = await synth("Καλημέρα!", "el", "el-GR-Chirp3-HD-Leda", "K123");
    expect(new TextDecoder().decode(mp3)).toBe("ID3fake");
    expect(calls[1].url).toBe("https://texttospeech.googleapis.com/v1/text:synthesize?key=K123");
    expect(JSON.parse(calls[1].body!)).toEqual({
      input: { text: "Καλημέρα!" }, voice: { languageCode: "el-GR", name: "el-GR-Chirp3-HD-Leda" }, audioConfig: { audioEncoding: "MP3" },
    });
    await synth("Καλημέρα!", "el", "el-GR-Chirp3-HD-Leda", "K123");
    expect(calls).toHaveLength(2);
  });
  it("passes Google's error message on", async () => {
    setFetchForTests((async () => new Response(JSON.stringify({ error: { message: "API key not valid." } }), { status: 400 })) as unknown as typeof fetch);
    await expect(synth("x", "ar", "ar-XA-Chirp3-HD-Aoede", "bad")).rejects.toThrow("API key not valid.");
  });
});
