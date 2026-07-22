#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if schematica_lib::run_ssh_askpass_if_requested() {
        return;
    }
    schematica_lib::run();
}
