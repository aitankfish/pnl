import ActivityKit
import SwiftUI
import WidgetKit

@available(iOS 16.1, *)
struct VoiceRoomLiveActivity: Widget {
    let kind: String = "VoiceRoomLiveActivity"

    var body: some WidgetConfiguration {
        ActivityConfiguration(for: VoiceRoomActivityAttributes.self) { context in
            // Lock Screen banner
            lockScreenBanner(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded regions
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 6) {
                        Image(systemName: "waveform.circle.fill")
                            .foregroundColor(Color(hex: 0x8B5CF6))
                            .font(.title2)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(context.attributes.marketName)
                                .font(.caption)
                                .fontWeight(.semibold)
                                .foregroundColor(.white)
                                .lineLimit(1)
                            Text("$\(context.attributes.tokenSymbol)")
                                .font(.caption2)
                                .foregroundColor(.gray)
                        }
                    }
                }

                DynamicIslandExpandedRegion(.trailing) {
                    HStack(spacing: 4) {
                        Image(systemName: "person.fill")
                            .font(.caption2)
                            .foregroundColor(.gray)
                        Text("\(context.state.participantCount)")
                            .font(.caption)
                            .foregroundColor(.white)
                    }
                }

                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        // Mute status
                        HStack(spacing: 4) {
                            Image(systemName: context.state.isMuted ? "mic.slash.fill" : "mic.fill")
                                .foregroundColor(context.state.isMuted ? .red : Color(hex: 0x8B5CF6))
                                .font(.caption)
                            Text(context.state.isMuted ? "Muted" : "Unmuted")
                                .font(.caption2)
                                .foregroundColor(.gray)
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.white.opacity(0.1))
                        .cornerRadius(8)

                        Spacer()

                        // Leave button
                        Link(destination: URL(string: "pnl://voice/leave")!) {
                            Text("Leave Room")
                                .font(.caption)
                                .fontWeight(.medium)
                                .foregroundColor(.white)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(Color.red.opacity(0.8))
                                .cornerRadius(8)
                        }
                    }
                    .padding(.top, 4)
                }
            } compactLeading: {
                Image(systemName: "waveform.circle.fill")
                    .foregroundColor(Color(hex: 0x8B5CF6))
                    .font(.caption)
            } compactTrailing: {
                HStack(spacing: 2) {
                    Text("\(context.state.participantCount)")
                        .font(.caption2)
                        .foregroundColor(.white)
                    Image(systemName: context.state.isMuted ? "mic.slash.fill" : "mic.fill")
                        .font(.caption2)
                        .foregroundColor(context.state.isMuted ? .red : Color(hex: 0x8B5CF6))
                }
            } minimal: {
                Image(systemName: "waveform.circle.fill")
                    .foregroundColor(Color(hex: 0x8B5CF6))
                    .font(.caption)
            }
            .widgetURL(URL(string: "pnl://market/\(context.attributes.marketId)"))
        }
    }

    @available(iOS 16.1, *)
    private func lockScreenBanner(context: ActivityViewContext<VoiceRoomActivityAttributes>) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "waveform.circle.fill")
                .foregroundColor(Color(hex: 0x8B5CF6))
                .font(.title2)

            VStack(alignment: .leading, spacing: 2) {
                Text(context.attributes.marketName)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
                    .lineLimit(1)

                HStack(spacing: 8) {
                    Text("$\(context.attributes.tokenSymbol)")
                        .font(.caption)
                        .foregroundColor(.gray)

                    HStack(spacing: 2) {
                        Image(systemName: "person.fill")
                            .font(.caption2)
                        Text("\(context.state.participantCount)")
                            .font(.caption)
                    }
                    .foregroundColor(.gray)
                }
            }

            Spacer()

            // Mute indicator
            Image(systemName: context.state.isMuted ? "mic.slash.fill" : "mic.fill")
                .foregroundColor(context.state.isMuted ? .red : Color(hex: 0x8B5CF6))
                .font(.callout)

            // Leave button
            Link(destination: URL(string: "pnl://voice/leave")!) {
                Text("Leave")
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundColor(.white)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Color.red.opacity(0.8))
                    .cornerRadius(8)
            }
        }
        .padding(16)
        .background(Color(hex: 0x0a0e1a))
    }
}

// MARK: - Color Extension

extension Color {
    init(hex: UInt, alpha: Double = 1.0) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255.0,
            green: Double((hex >> 8) & 0xFF) / 255.0,
            blue: Double(hex & 0xFF) / 255.0,
            opacity: alpha
        )
    }
}
