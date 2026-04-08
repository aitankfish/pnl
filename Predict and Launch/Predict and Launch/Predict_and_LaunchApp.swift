//
//  Predict_and_LaunchApp.swift
//  Predict and Launch
//
//  Created by Bishwanath Bastola on 2/27/26.
//

import SwiftUI
import CoreData

@main
struct Predict_and_LaunchApp: App {
    let persistenceController = PersistenceController.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(\.managedObjectContext, persistenceController.container.viewContext)
        }
    }
}
